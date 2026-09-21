/**
 * UpdateSupplierPricesUseCase
 *
 * Single, reusable application service that imports the supplier's JSON
 * price feed into the review pipeline. Both the Admin "Actualizar precios"
 * button and the Vercel Cron endpoint call this exact function — neither of
 * them contains any matching, pricing, or persistence logic of their own.
 *
 * IMPORTANT: this use case never writes to `Product.price` / `noShrinkPrice`
 * / `b2bPrice` / `b2bPriceNoShrink`. It only records the imported JPY prices
 * into `PriceHistory` (same as the manual Google Sheets flow) and returns a
 * review report so an administrator can confirm — with the same margin
 * controls used today — whether/how the catalog price should change, or
 * create a brand new product when no catalog match exists.
 *
 * Pipeline:
 *   supplier-feed.ts   → download + category filter ("Pokemon Box" only) + group by product
 *   matcher.ts         → fuzzy-match supplier product name → catalog product (PriceMapping first)
 *   currency.ts        → JPY → EUR conversion (for history only)
 *   history.ts         → PriceHistory persistence (unchanged data model)
 *
 * A failure on one row (bad data, DB error) is isolated and recorded in the
 * execution report; it never aborts the rest of the sync.
 */

import { db } from '@/lib/db';
import { fetchSupplierPriceFeed, type SupplierGroupedRow } from '@/lib/price-import/supplier-feed';
import { findBestMatch } from '@/lib/price-import/matcher';
import { getJpyToEurRate } from '@/lib/price-import/currency';
import {
  recordPriceHistoryBatch,
  type RecordHistoryEntry,
  type RecordedHistoryResult,
} from '@/lib/price-import/history';
import { captureServerError } from '@/lib/observability/sentry';
import { ProductVariant } from '@prisma/client';
import type { ImportedRow } from '@/app/api/admin/price-import/sheets/route';

// ── Report types ─────────────────────────────────────────────────────────────

export interface SkippedRowEntry {
  product: string;
  reason: string;
}

export interface RowErrorEntry {
  product: string;
  message: string;
}

export interface SupplierPriceUpdateReport {
  processedRows: number;
  /** One entry per supplier product, ready for the admin review table (same shape as the sheets import). */
  items: ImportedRow[];
  skippedProducts: SkippedRowEntry[];
  ignoredCategories: number;
  errors: RowErrorEntry[];
  exchangeRate: number;
  exchangeRateSource: string;
  /** Per (product, variant) historical-minimum flags — mirrors `POST /history`'s response. */
  historyResults: RecordedHistoryResult[];
  durationMs: number;
}

export interface UpdateSupplierPricesOptions {
  /** Overrides `process.env.SUPPLIER_PRICE_URL` — mainly for tests. */
  supplierUrl?: string;
  /** Minimum similarity score (0–1) required for a fuzzy match. */
  matchThreshold?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyReport(durationMs: number): SupplierPriceUpdateReport {
  return {
    processedRows: 0,
    items: [],
    skippedProducts: [],
    ignoredCategories: 0,
    errors: [],
    exchangeRate: 0,
    exchangeRateSource: '',
    historyResults: [],
    durationMs,
  };
}

/** Builds the admin-review row for one grouped supplier product. */
function buildImportedRow(
  row: SupplierGroupedRow,
  match: { productId: string; productName: string; score: number } | null,
  matchSource: 'manual' | 'fuzzy' | null
): ImportedRow {
  // Mirrors the sheets convention: a "left" row's primary price is the SHRINK
  // variant with the NO_SHRINK price attached as `correspondingRightJpyPrice`.
  // Falls back to a lone "right" row when only NO_SHRINK is available.
  const hasShrink = row.jpyShrink !== null;
  const jpyPrice = hasShrink ? row.jpyShrink! : row.jpyNoShrink!;
  const correspondingRightJpyPrice = hasShrink ? row.jpyNoShrink : null;

  return {
    importedName: row.product,
    jpyPrice,
    correspondingRightJpyPrice,
    sourceRow: 0,
    sourceGroup: hasShrink ? 'left' : 'right',
    matchedProductId: match?.productId ?? null,
    matchedProductName: match?.productName ?? null,
    matchScore: match ? Math.round(match.score * 100) / 100 : null,
    matchSource,
  };
}

/** Builds the `PriceHistory` entries for one grouped supplier product (both variants, when present). */
function buildHistoryEntries(row: SupplierGroupedRow, catalogProductId: string | null): RecordHistoryEntry[] {
  const entries: RecordHistoryEntry[] = [];
  if (row.jpyShrink !== null) {
    entries.push({ catalogProductId, variant: ProductVariant.SHRINK, sheetProductName: row.product, priceJpy: row.jpyShrink });
  }
  if (row.jpyNoShrink !== null) {
    entries.push({ catalogProductId, variant: ProductVariant.NO_SHRINK, sheetProductName: row.product, priceJpy: row.jpyNoShrink });
  }
  return entries;
}

// ── Use case ─────────────────────────────────────────────────────────────────

/**
 * Runs one full supplier feed → review-report synchronization. Never throws
 * for per-row failures; only pre-conditions that make the whole sync
 * impossible (missing URL, unreachable feed) short circuit and are reported
 * via `errors`.
 */
export async function runUpdateSupplierPricesUseCase(
  options: UpdateSupplierPricesOptions = {}
): Promise<SupplierPriceUpdateReport> {
  const startedAt = Date.now();
  const threshold = options.matchThreshold ?? 0.65;
  const supplierUrl = options.supplierUrl ?? process.env.SUPPLIER_PRICE_URL ?? '';

  console.info('[supplier-price-sync] started');

  // ── Preconditions: download feed, load catalog + mappings, resolve rate ───
  let feed: Awaited<ReturnType<typeof fetchSupplierPriceFeed>>;
  let products: { id: string; name: string }[];
  let mappingLookup: Map<string, string>;
  let exchangeRate: number;
  let exchangeRateSource: string;

  try {
    console.info('[supplier-price-sync] downloading supplier feed', { supplierUrl });
    feed = await fetchSupplierPriceFeed(supplierUrl);

    const [loadedProducts, mappings, rate] = await Promise.all([
      db.product.findMany({ select: { id: true, name: true } }),
      db.priceMapping.findMany({ select: { importedName: true, productId: true } }),
      getJpyToEurRate(),
    ]);

    products = loadedProducts;
    mappingLookup = new Map(mappings.map((m) => [m.importedName.toLowerCase(), m.productId]));
    exchangeRate = rate.rate;
    exchangeRateSource = rate.source;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al iniciar la sincronización.';
    captureServerError({ error: err, module: 'price-import.supplier-sync', extra: { supplierUrl } });
    console.error('[supplier-price-sync] aborted before processing rows', { message });
    const report = emptyReport(Date.now() - startedAt);
    report.errors.push({ product: '(global)', message });
    return report;
  }

  console.info('[supplier-price-sync] supplier feed downloaded', {
    totalRows: feed.totalRows,
    pokemonBoxProducts: feed.rows.length,
    ignoredCategories: feed.ignoredCategories,
  });

  const productLookup = new Map(products.map((p) => [p.id, p.name]));
  const report = emptyReport(0);
  report.ignoredCategories = feed.ignoredCategories;
  report.processedRows = feed.rows.length;
  report.skippedProducts = feed.skipped;
  report.exchangeRate = exchangeRate;
  report.exchangeRateSource = exchangeRateSource;

  const historyEntries: RecordHistoryEntry[] = [];

  // ── Match + stage each product for review (no DB writes here) ────────────
  for (const row of feed.rows) {
    try {
      const manualProductId = mappingLookup.get(row.product.toLowerCase());
      if (manualProductId) {
        const match = { productId: manualProductId, productName: productLookup.get(manualProductId) ?? '', score: 1 };
        report.items.push(buildImportedRow(row, match, 'manual'));
        historyEntries.push(...buildHistoryEntries(row, manualProductId));
        continue;
      }

      // Product matching is delegated entirely to the isolated matcher service.
      const fuzzyMatch = findBestMatch(row.product, products, threshold);
      report.items.push(buildImportedRow(row, fuzzyMatch, fuzzyMatch ? 'fuzzy' : null));
      historyEntries.push(...buildHistoryEntries(row, fuzzyMatch?.productId ?? null));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al procesar la fila.';
      report.errors.push({ product: row.product, message });
      captureServerError({ error: err, module: 'price-import.supplier-sync', extra: { row } });
    }
  }

  // ── Persist history for every imported row (matched or not) ──────────────
  if (historyEntries.length > 0) {
    try {
      report.historyResults = await recordPriceHistoryBatch(historyEntries, exchangeRate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el histórico de precios.';
      report.errors.push({ product: '(history batch)', message });
      captureServerError({ error: err, module: 'price-import.supplier-sync' });
    }
  }

  report.durationMs = Date.now() - startedAt;

  console.info('[supplier-price-sync] finished', {
    processedRows: report.processedRows,
    matched: report.items.filter((i) => i.matchedProductId).length,
    unmatched: report.items.filter((i) => !i.matchedProductId).length,
    skipped: report.skippedProducts.length,
    ignoredCategories: report.ignoredCategories,
    errors: report.errors.length,
    durationMs: report.durationMs,
  });

  return report;
}

