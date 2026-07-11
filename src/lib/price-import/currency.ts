/**
 * Currency conversion service — JPY → EUR.
 *
 * Uses the Frankfurter API (https://www.frankfurter.app/) as the primary source.
 * Falls back to a hardcoded approximate rate when the API is unavailable.
 *
 * The module-level cache prevents redundant API calls within the same server
 * process lifetime (typically the duration of a single import operation in
 * serverless environments).
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RateCache {
  rate: number;
  source: string;
  fetchedAt: number;
}

// Module-level in-process cache
let rateCache: RateCache | null = null;

/** Approximate fallback rate (updated periodically). 1 JPY ≈ 0.0062 EUR */
const FALLBACK_RATE = 0.0062;

export interface ExchangeRateResult {
  rate: number;
  source: string;
}

/**
 * Returns the current JPY → EUR exchange rate.
 * Results are cached for 1 hour to avoid excessive API requests during a
 * single import session.
 */
export async function getJpyToEurRate(): Promise<ExchangeRateResult> {
  if (rateCache && Date.now() - rateCache.fetchedAt < CACHE_TTL_MS) {
    return { rate: rateCache.rate, source: rateCache.source };
  }

  // ── Primary: Frankfurter API ─────────────────────────────────────────────
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=JPY&to=EUR', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json() as { rates?: { EUR?: number } };
      const rate = data.rates?.EUR;
      if (typeof rate === 'number' && rate > 0) {
        rateCache = { rate, source: 'Frankfurter API', fetchedAt: Date.now() };
        return { rate, source: 'Frankfurter API' };
      }
    }
  } catch {
    // Fall through to fallback
  }

  // ── Fallback: hardcoded approximate rate ─────────────────────────────────
  rateCache = { rate: FALLBACK_RATE, source: 'Tasa aproximada (sin conexión)', fetchedAt: Date.now() };
  return { rate: FALLBACK_RATE, source: 'Tasa aproximada (sin conexión)' };
}

/**
 * Convert a JPY amount to EUR using the provided rate.
 * Returns the value rounded to 4 decimal places for display precision.
 */
export function convertJpyToEur(jpyAmount: number, rate: number): number {
  return Math.round(jpyAmount * rate * 10000) / 10000;
}

/**
 * Snap a raw price to the nearest .95 ending, always rounding UP
 * so the final price never falls below the intended margin.
 *
 * Examples:
 *   100.87 → 100.95
 *   100.95 → 100.95  (already snapped)
 *   100.96 → 101.95
 */
export function snapToRetailPrice(price: number): number {
  const euros = Math.floor(price);
  // Math.round neutralises floating-point drift (e.g. 0.95 * 100 → 94.9999…)
  const cents = Math.round((price - euros) * 100);

  if (cents <= 95) return euros + 0.95;
  return euros + 1.95; // 96–99 cents → next euro .95
}

/** Default profit margins used by the admin price update modal for each variant. */
export const DEFAULT_PRICE_VARIANT_MARGINS = {
  shrink: 25,
  noShrink: 20,
  b2b: 15,
  b2bNoShrink: 12,
} as const;

export type PriceVariantKey = keyof typeof DEFAULT_PRICE_VARIANT_MARGINS;

export interface VariantPriceBreakdown {
  finalPrice: number;
  benefit: number;
  marginPercent: number;
  marginComponents: {
    costMarginPercent: number;
    vatPercent: number;
    profitMarginPercent: number;
  };
}

export interface VariantPriceBreakdownMap {
  shrink: VariantPriceBreakdown;
  noShrink: VariantPriceBreakdown;
  b2b: VariantPriceBreakdown;
  b2bNoShrink: VariantPriceBreakdown;
}

function buildVariantBreakdown(eurCost: number, marginPercent: number): VariantPriceBreakdown {
  const taxInclusiveBase = eurCost * COST_MARGIN_FACTOR * VAT_FACTOR;
  const raw = taxInclusiveBase * (1 + marginPercent / 100);
  const finalPrice = snapToRetailPrice(raw);

  return {
    finalPrice,
    benefit: Math.max(0, finalPrice - eurCost),
    marginPercent,
    marginComponents: {
      costMarginPercent: COST_MARGIN_PERCENT,
      vatPercent: VAT_PERCENT,
      profitMarginPercent: marginPercent,
    },
  };
}

export function computeVariantPriceBreakdown(
  eurCost: number,
  margins: Partial<Record<PriceVariantKey, number>> = {},
  variantCosts: Partial<Record<PriceVariantKey, number>> = {}
): VariantPriceBreakdownMap {
  const variantMargins = { ...DEFAULT_PRICE_VARIANT_MARGINS, ...margins };
  const resolvedVariantCosts = {
    shrink: eurCost,
    noShrink: variantCosts.noShrink ?? eurCost,
    b2b: eurCost,
    b2bNoShrink: variantCosts.b2bNoShrink ?? variantCosts.noShrink ?? eurCost,
  } satisfies Record<PriceVariantKey, number>;

  return {
    shrink: buildVariantBreakdown(resolvedVariantCosts.shrink, variantMargins.shrink),
    noShrink: buildVariantBreakdown(resolvedVariantCosts.noShrink, variantMargins.noShrink),
    b2b: buildVariantBreakdown(resolvedVariantCosts.b2b, variantMargins.b2b),
    b2bNoShrink: buildVariantBreakdown(
      resolvedVariantCosts.b2bNoShrink,
      variantMargins.b2bNoShrink
    ),
  };
}

/** 2.7% operational margin applied to the origin (import) cost before tax. */
const COST_MARGIN_PERCENT = 2.7;
const COST_MARGIN_FACTOR = 1.027;

/** 21% VAT applied after the cost margin. */
const VAT_PERCENT = 21;
const VAT_FACTOR = 1.21;

/**
 * Compute the suggested selling price given a EUR cost and a profit margin percentage.
 *
 * Pipeline:
 *   1. Apply 2.7% cost margin  → eurCost × 1.027
 *   2. Apply 21% VAT           → × 1.21
 *   3. Apply profit margin     → × (1 + marginPercent / 100)
 *   4. Snap to nearest .95     → e.g. 100.87 → 100.95
 *
 * @param eurCost      - The raw import cost in EUR (converted from JPY, pre-tax).
 * @param marginPercent - Profit margin as a percentage above the tax-inclusive base
 *                        (e.g. 25 → ×1.25). Default suggested value is 25.
 */
export function computeSellingPrice(eurCost: number, marginPercent: number): number {
  const taxInclusiveBase = eurCost * COST_MARGIN_FACTOR * VAT_FACTOR;
  const raw = taxInclusiveBase * (1 + marginPercent / 100);
  return snapToRetailPrice(raw);
}

/** 2.7% business margin applied to the import cost for B2B pricing. */
const B2B_BUSINESS_MARGIN = 0.027;
/** 10% commercial margin for wholesale customers. */
const B2B_COMMERCIAL_MARGIN = 0.10;
/** 2% shipping cost recovered through the wholesale price. */
const B2B_SHIPPING_MARGIN = 0.02;

/** Aggregate multiplier applied to the EUR cost when computing a B2B price. */
export const B2B_PRICE_MULTIPLIER =
  1 + B2B_BUSINESS_MARGIN + B2B_COMMERCIAL_MARGIN + B2B_SHIPPING_MARGIN;

/**
 * Compute the wholesale (B2B) price from the raw imported EUR cost.
 *
 * Formula:
 *     eurCost × (1 + 2.7% business margin + 10% commercial margin + 2% shipping)
 *   = eurCost × 1.147
 *
 * Rounded to 2 decimals (EUR cents). Unlike the retail price, no VAT is added
 * — wholesale invoices carry VAT separately per Spanish B2B billing rules,
 * and no ".95 snapping" is performed so the value reflects the true cost
 * structure exposed to business customers.
 */
export function computeB2bPrice(eurCost: number): number {
  if (!isFinite(eurCost) || eurCost <= 0) return 0;
  return Math.round(eurCost * B2B_PRICE_MULTIPLIER * 100) / 100;
}
