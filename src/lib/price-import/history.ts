/**
 * Historical price tracking service.
 *
 * Responsibilities:
 *  - Record a batch of imported purchase prices (JPY → EUR, pre-margin) as
 *    daily historical data points, with same-day upsert semantics
 *    ("last import of the day wins").
 *  - Detect whether the price recorded today is the all-time historical
 *    minimum for the (sheetProductName, variant) pair.
 *  - Fetch chronologically-ordered chart data for a single product variant.
 *
 * Data model contract (mirrors prisma/schema.prisma `PriceHistory`):
 *  - Uniqueness: (sheetProductName, variant, importDate) — history is tracked
 *    per imported name, so rows that have not (yet) been matched to a catalog
 *    product still contribute to the historical series.
 *  - `catalogProductId` is optional and used only for auxiliary bookkeeping.
 *  - importDate is stored as a DATE (UTC calendar day) — one row per day max.
 *  - purchasePriceEur is the raw converted cost BEFORE any profit margin,
 *    rounded to 4 decimals to match `convertJpyToEur`.
 */

import { db } from '@/lib/db';
import { convertJpyToEur } from '@/lib/price-import/currency';
import type { ProductVariant } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RecordHistoryEntry {
  /** Optional — populated when the imported row has a resolved catalog product. */
  catalogProductId?: string | null;
  variant: ProductVariant;
  sheetProductName: string;
  priceJpy: number;
}

export interface RecordedHistoryResult {
  /** `${sheetProductName}:${variant}` — stable key for client lookup. */
  key: string;
  sheetProductName: string;
  catalogProductId: string | null;
  variant: ProductVariant;
  /** Purchase price in EUR persisted today, rounded to 4 decimals. */
  purchasePriceEur: number;
  /** True when today's purchase price equals the all-time minimum for this variant. */
  isHistoricalMin: boolean;
  /** All-time minimum purchase price for this (sheetProductName, variant), including today. */
  historicalMinEur: number;
}

export interface ChartPoint {
  /** ISO date (YYYY-MM-DD) — matches the DATE column. */
  date: string;
  purchasePriceEur: number;
  priceJpy: number;
  exchangeRate: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the current calendar day in UTC as a Date positioned at midnight UTC.
 * Using UTC keeps deduplication deterministic across server timezones and DST
 * transitions.
 */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Compose the stable per-(imported name, variant) key used across API responses. */
export function historyKey(sheetProductName: string, variant: ProductVariant): string {
  return `${sheetProductName}:${variant}`;
}

/**
 * Round a decimal number returned by Prisma (as string) to a plain number with
 * up to 4 fractional digits. Guards against floating-point drift in comparisons.
 */
function toNumber4(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a batch of imported prices. For each entry, either creates a new
 * PriceHistory row for today or updates the existing one (same-day dedup).
 *
 * Returns per-entry historical-minimum information suitable for driving the
 * star icon in the price import table.
 *
 * Design notes:
 *  - Upserts are executed inside a single transaction so a partial failure
 *    leaves no orphan rows.
 *  - After upsert, a single `groupBy` computes the current MIN(purchasePriceEur)
 *    across the touched (productId, variant) pairs. The composite index on
 *    (catalogProductId, variant, purchasePriceEur) keeps this scan O(log n).
 */
export async function recordPriceHistoryBatch(
  entries: RecordHistoryEntry[],
  exchangeRate: number
): Promise<RecordedHistoryResult[]> {
  if (entries.length === 0) return [];

  const importDate = todayUtc();
  const importTimestamp = new Date();

  // ── Deduplicate entries by (sheetProductName, variant) before writing ─────
  //    (same import batch could theoretically list the same imported name
  //     twice, e.g. two catalog products point at one sheet row). Keep the
  //     last one for a deterministic outcome.
  const dedupedMap = new Map<string, RecordHistoryEntry>();
  for (const e of entries) {
    dedupedMap.set(historyKey(e.sheetProductName, e.variant), e);
  }
  const deduped = Array.from(dedupedMap.values());

  // ── Compute the EUR purchase price for each entry using the shared helper ──
  const prepared = deduped.map((e) => ({
    ...e,
    catalogProductId: e.catalogProductId ?? null,
    purchasePriceEur: convertJpyToEur(e.priceJpy, exchangeRate),
  }));

  // ── Upsert every entry inside one transaction ─────────────────────────────
  await db.$transaction(
    prepared.map((e) =>
      db.priceHistory.upsert({
        where: {
          sheetProductName_variant_importDate: {
            sheetProductName: e.sheetProductName,
            variant: e.variant,
            importDate,
          },
        },
        create: {
          catalogProductId: e.catalogProductId,
          variant: e.variant,
          sheetProductName: e.sheetProductName,
          importDate,
          importTimestamp,
          priceJpy: e.priceJpy,
          exchangeRate,
          purchasePriceEur: e.purchasePriceEur,
        },
        update: {
          // Keep the catalog association in sync so linking a previously
          // unmatched name backfills the FK on the next import.
          catalogProductId: e.catalogProductId,
          importTimestamp,
          priceJpy: e.priceJpy,
          exchangeRate,
          purchasePriceEur: e.purchasePriceEur,
        },
      })
    )
  );

  // ── Compute the current historical minimum per touched (name, variant) ────
  const mins = await db.priceHistory.groupBy({
    by: ['sheetProductName', 'variant'],
    where: {
      OR: prepared.map((e) => ({
        sheetProductName: e.sheetProductName,
        variant: e.variant,
      })),
    },
    _min: { purchasePriceEur: true },
  });

  const minLookup = new Map<string, number>();
  for (const row of mins) {
    const min = toNumber4(row._min.purchasePriceEur);
    minLookup.set(historyKey(row.sheetProductName, row.variant), min);
  }

  // ── Assemble the per-entry result ─────────────────────────────────────────
  return prepared.map((e) => {
    const key = historyKey(e.sheetProductName, e.variant);
    const historicalMin = minLookup.get(key) ?? e.purchasePriceEur;
    const today = toNumber4(e.purchasePriceEur);
    return {
      key,
      sheetProductName: e.sheetProductName,
      catalogProductId: e.catalogProductId,
      variant: e.variant,
      purchasePriceEur: today,
      isHistoricalMin: today <= historicalMin, // toNumber4 guards against drift
      historicalMinEur: historicalMin,
    };
  });
}

/**
 * Fetch the chronologically-ordered historical price series for a single
 * product variant. Returns an empty array when no history exists.
 *
 * Consumers (chart component) plot the returned points directly and connect
 * gaps in the timeline by drawing straight segments between adjacent points —
 * no artificial in-between values are generated.
 */
export async function getPriceHistoryChart(
  catalogProductId: string,
  variant: ProductVariant
): Promise<ChartPoint[]> {
  const rows = await db.priceHistory.findMany({
    where: { catalogProductId, variant },
    orderBy: { importDate: 'asc' },
    select: {
      importDate: true,
      purchasePriceEur: true,
      priceJpy: true,
      exchangeRate: true,
    },
  });

  return rows.map((r) => ({
    // Serialize as YYYY-MM-DD so client-side date parsing is unambiguous.
    date: r.importDate.toISOString().slice(0, 10),
    purchasePriceEur: toNumber4(r.purchasePriceEur),
    priceJpy: toNumber4(r.priceJpy),
    exchangeRate: toNumber4(r.exchangeRate),
  }));
}

/**
 * Fetch all historical price data for a given variant across every imported
 * product, grouped by the sheet product name. This intentionally uses the
 * imported name (not the catalog product name) so the chart reflects what
 * was actually seen in the source spreadsheet — including rows that have
 * never been linked to a catalog product.
 *
 * Returns a map where keys are the sheet product names and values are
 * chronologically-sorted arrays of chart points.
 */
export async function getPriceHistoryChartByVariant(
  variant: ProductVariant
): Promise<Map<string, { productName: string; points: ChartPoint[] }>> {
  const rows = await db.priceHistory.findMany({
    where: { variant },
    orderBy: [{ sheetProductName: 'asc' }, { importDate: 'asc' }],
    select: {
      sheetProductName: true,
      importDate: true,
      purchasePriceEur: true,
      priceJpy: true,
      exchangeRate: true,
    },
  });

  const grouped = new Map<string, { productName: string; points: ChartPoint[] }>();

  for (const r of rows) {
    const name = r.sheetProductName;
    let data = grouped.get(name);
    if (!data) {
      data = { productName: name, points: [] };
      grouped.set(name, data);
    }
    data.points.push({
      date: r.importDate.toISOString().slice(0, 10),
      purchasePriceEur: toNumber4(r.purchasePriceEur),
      priceJpy: toNumber4(r.priceJpy),
      exchangeRate: toNumber4(r.exchangeRate),
    });
  }

  return grouped;
}
