/**
 * Supplier JSON price feed downloader.
 *
 * Fetches the supplier's product/price feed from `SUPPLIER_PRICE_URL` (a JSON
 * array of rows, see `data.json` for the shape) and keeps only the rows the
 * business cares about (`category === "Pokemon Box"`). Every other category is
 * counted and discarded.
 *
 * The supplier lists the SHRINK and NO_SHRINK price of the same physical
 * product as two separate rows sharing the same `product` name (mirrors the
 * left/right column pairing used by the legacy Google Sheets import). This
 * module groups them back into a single row per product so downstream code
 * can treat it exactly like one imported sheet item.
 *
 * This module only knows the wire format — no matching, pricing, or
 * persistence logic lives here.
 */

export type SupplierVariant = 'SHRINK' | 'NO_SHRINK';

export interface SupplierGroupedRow {
  product: string;
  jpyShrink: number | null;
  jpyNoShrink: number | null;
}

export interface SupplierFeedSkippedRow {
  product: string;
  reason: string;
}

export interface SupplierFeedResult {
  /** One entry per distinct product name within `TARGET_CATEGORY`. */
  rows: SupplierGroupedRow[];
  /** Total rows returned by the supplier, regardless of category. */
  totalRows: number;
  /** Count of rows discarded because their category wasn't `TARGET_CATEGORY`. */
  ignoredCategories: number;
  /** Rows within `TARGET_CATEGORY` that couldn't be parsed (bad name/price/shrink value). */
  skipped: SupplierFeedSkippedRow[];
}

const TARGET_CATEGORY = 'Pokemon Box';

/** "WITH SHRINK" → SHRINK, "NO SHRINK" → NO_SHRINK. Anything else is unmapped. */
export function mapShrinkToVariant(shrink: string): SupplierVariant | null {
  const normalized = shrink.trim().toUpperCase();
  if (normalized === 'WITH SHRINK') return 'SHRINK';
  if (normalized === 'NO SHRINK') return 'NO_SHRINK';
  return null;
}

function isPlainRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fetch and parse the supplier JSON feed, returning only "Pokemon Box" rows.
 *
 * @throws Error with a human-readable message when the URL is missing, the
 *         request fails, or the response isn't a JSON array.
 */
export async function fetchSupplierPriceFeed(url: string): Promise<SupplierFeedResult> {
  if (!url.trim()) {
    throw new Error('SUPPLIER_PRICE_URL no está configurada.');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Cron/admin-triggered sync always wants fresh data.
      cache: 'no-store',
    });
  } catch {
    throw new Error('No se pudo conectar con la fuente de precios del proveedor.');
  }

  if (!response.ok) {
    throw new Error(`Error al descargar el feed del proveedor (HTTP ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('El feed del proveedor no es un JSON válido.');
  }

  if (!Array.isArray(data)) {
    throw new Error('El feed del proveedor debe ser un array de productos.');
  }

  const grouped = new Map<string, SupplierGroupedRow>();
  const skipped: SupplierFeedSkippedRow[] = [];
  let ignoredCategories = 0;

  for (const raw of data) {
    if (!isPlainRow(raw)) continue;

    const category = typeof raw.category === 'string' ? raw.category : '';
    if (category !== TARGET_CATEGORY) {
      ignoredCategories++;
      continue;
    }

    const product = typeof raw.product === 'string' ? raw.product.trim() : '';
    const shrinkRaw = typeof raw.shrink === 'string' ? raw.shrink : '';
    const jpy = typeof raw.jpy === 'number' ? raw.jpy : parseFloat(String(raw.jpy));

    if (!product) {
      skipped.push({ product: '(sin nombre)', reason: 'Falta el nombre del producto.' });
      continue;
    }
    if (!isFinite(jpy) || jpy <= 0) {
      skipped.push({ product, reason: 'Precio JPY inválido.' });
      continue;
    }
    const variant = mapShrinkToVariant(shrinkRaw);
    if (!variant) {
      skipped.push({ product, reason: `Valor de "shrink" no reconocido: "${shrinkRaw}".` });
      continue;
    }

    let entry = grouped.get(product);
    if (!entry) {
      entry = { product, jpyShrink: null, jpyNoShrink: null };
      grouped.set(product, entry);
    }
    if (variant === 'SHRINK') entry.jpyShrink = jpy;
    else entry.jpyNoShrink = jpy;
  }

  return { rows: Array.from(grouped.values()), totalRows: data.length, ignoredCategories, skipped };
}
