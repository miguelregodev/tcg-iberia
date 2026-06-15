function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const thresholdFromEnv =
  process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? process.env.FREE_SHIPPING_THRESHOLD;
const shippingCostFromEnv =
  process.env.NEXT_PUBLIC_STANDARD_SHIPPING_COST ?? process.env.STANDARD_SHIPPING_COST;

export const SHIPPING_CONFIG = {
  // Keep current behavior by default; can be overridden via env.
  freeShippingThreshold: parseNumber(thresholdFromEnv, 200),
  standardShippingCost: parseNumber(shippingCostFromEnv, 6.95),
} as const;
