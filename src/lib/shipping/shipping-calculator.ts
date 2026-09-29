import { Decimal } from '@prisma/client/runtime/library';
import { isCanaryIslandsPostalCode } from './postal-codes';

/**
 * Represents the complete physical dimensions of a package in centimeters.
 * Dimensions are stored normalized: [longest, middle, shortest].
 */
interface PackageDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/**
 * A single order item with quantity and product physical properties.
 */
export interface ShippingItem {
  quantity: number;
  weightGrams?: number | null;
  lengthCm?: number | null | Decimal;
  widthCm?: number | null | Decimal;
  heightCm?: number | null | Decimal;
}

/**
 * The result of a shipping cost calculation.
 */
export interface ShippingCalculationResult {
  /** Whether this shipping method is available for the given package. */
  available: boolean;
  /** The calculated shipping cost in EUR, or null if unavailable. */
  price: number | null;
  /** Whether the order qualifies for free shipping. */
  isFree: boolean;
  /** The zone: STANDARD or CANARY. */
  zone: 'STANDARD' | 'CANARY';
  /** Reason for unavailability (e.g., "weight_exceeds_limit", "dimensions_exceed_limit", "missing_shipping_data"). */
  reason?: string;
  /** Total weight of the package in grams. */
  totalWeightGrams: number;
  /** Length of the package in centimeters. */
  packageLengthCm: number;
  /** Width of the package in centimeters. */
  packageWidthCm: number;
  /** Height of the package in centimeters. */
  packageHeightCm: number;
}

/**
 * Shipping configuration for all supported tiers and zones.
 * Prices in EUR. Weights in grams. Dimensions in centimeters.
 */
const SHIPPING_CONFIG = {
  standard: {
    tier1: {
      maxWeightGrams: 2000,
      maxDimensionsCm: [30, 20, 20] as const,
      price: 4.99,
    },
    tier2: {
      minWeightGrams: 2001,
      maxWeightGrams: 5000,
      maxDimensionsCm: [35, 24, 35] as const,
      price: 5.99,
    },
  },
  canary: {
    tier1: {
      maxWeightGrams: 2000,
      maxDimensionsCm: [30, 20, 20] as const,
      price: 10.99,
    },
    tier2: {
      minWeightGrams: 2001,
      maxWeightGrams: 5000,
      maxDimensionsCm: [35, 24, 35] as const,
      price: 14.99,
    },
  },
} as const;

/**
 * Converts a value that may be a Decimal, number, or null to a plain number.
 */
function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return value.toNumber();
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculates the dimensions of a package containing multiple items.
 *
 * Heuristic: "Rectangular Stack Packing"
 * ─────────────────────────────────────
 * 1. Each product contributes a rectangular footprint (L × W × H).
 * 2. Items are "stacked" with the quantity determining height growth.
 * 3. Normalize so that [length, width, height] are always sorted
 *    [longest, middle, shortest] for consistent comparison with tier limits.
 *
 * Algorithm:
 * - Calculate effective dimensions for each quantity of each product.
 * - For a product with quantity > 1, stack it: new dimensions are
 *   (original length, original width, original height × quantity).
 * - Combine all products: final box dimensions are the max of each axis.
 * - Normalize: sort the three dimensions to get consistent ordering.
 *
 * This is conservative and deterministic, suitable for later replacement
 * with a more sophisticated 3D bin-packing algorithm.
 *
 * @param items Array of items with quantities and dimensions.
 * @returns Normalized package dimensions [longest, middle, shortest].
 */
function calculatePackageDimensions(items: ShippingItem[]): PackageDimensions {
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;

  for (const item of items) {
    if (
      item.lengthCm === null ||
      item.lengthCm === undefined ||
      item.widthCm === null ||
      item.widthCm === undefined ||
      item.heightCm === null ||
      item.heightCm === undefined
    ) {
      // Missing dimensions for this item; cannot calculate package size.
      // Return null to signal error upstream.
      return { lengthCm: -1, widthCm: -1, heightCm: -1 };
    }

    const length = toNumber(item.lengthCm) || 0;
    const width = toNumber(item.widthCm) || 0;
    const height = toNumber(item.heightCm) || 0;

    // Stack items by multiplying height (height grows with quantity).
    const stackedHeight = height * item.quantity;

    maxLength = Math.max(maxLength, length);
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, stackedHeight);
  }

  // Normalize: sort dimensions so longest ≥ middle ≥ shortest.
  const dims = [maxLength, maxWidth, maxHeight].sort((a, b) => b - a);

  return {
    lengthCm: dims[0],
    widthCm: dims[1],
    heightCm: dims[2],
  };
}

/**
 * Checks whether the given dimensions fit within the allowed tier dimensions.
 *
 * Normalization: Both the package and tier dimensions are sorted
 * [longest, middle, shortest] so that comparison is orientation-agnostic.
 *
 * @param packageDims The package dimensions [length, width, height].
 * @param tierDims The tier's max dimensions [length, width, height].
 * @returns true if the package fits within the tier.
 */
function fitsDimensions(
  packageDims: PackageDimensions,
  tierDims: readonly [number, number, number]
): boolean {
  const packageSorted = [
    packageDims.lengthCm,
    packageDims.widthCm,
    packageDims.heightCm,
  ].sort((a, b) => b - a);

  const tierSorted = [...tierDims].sort((a, b) => b - a);

  return (
    packageSorted[0] <= tierSorted[0] &&
    packageSorted[1] <= tierSorted[1] &&
    packageSorted[2] <= tierSorted[2]
  );
}

/**
 * Calculates the total weight of an order.
 *
 * @param items Array of items with quantities and weights.
 * @returns Total weight in grams, or -1 if any item has missing weight data.
 */
function calculateTotalWeight(items: ShippingItem[]): number {
  let totalWeight = 0;

  for (const item of items) {
    if (item.weightGrams === null || item.weightGrams === undefined) {
      // Missing weight data; cannot calculate total weight.
      return -1;
    }
    totalWeight += item.weightGrams * item.quantity;
  }

  return totalWeight;
}

/**
 * Calculates the shipping cost for an order.
 *
 * Flow:
 * 1. Validate that all items have weight and dimension data.
 * 2. Calculate total package weight and dimensions.
 * 3. Determine if the destination is Canary Islands.
 * 4. If Canary: Apply Canary pricing (never free).
 * 5. Else: Apply standard pricing, then apply free-shipping threshold if applicable.
 * 6. Return structured result with availability, price, zone, and package metrics.
 *
 * @param items Array of order items with quantities and physical properties.
 * @param postalCode The destination postal code (for Canary detection).
 * @param subtotalEur The order subtotal in EUR (for free-shipping threshold check).
 * @param freeShippingThresholdEur The order amount above which shipping is free (standard only).
 * @returns The shipping calculation result.
 */
export function calculateShippingCost(
  items: ShippingItem[],
  postalCode: string,
  subtotalEur: number,
  freeShippingThresholdEur: number
): ShippingCalculationResult {
  // Validate non-empty order.
  if (!items || items.length === 0) {
    return {
      available: false,
      price: null,
      isFree: false,
      zone: 'STANDARD',
      reason: 'empty_order',
      totalWeightGrams: 0,
      packageLengthCm: 0,
      packageWidthCm: 0,
      packageHeightCm: 0,
    };
  }

  // Calculate total weight.
  const totalWeightGrams = calculateTotalWeight(items);
  if (totalWeightGrams === -1) {
    return {
      available: false,
      price: null,
      isFree: false,
      zone: 'STANDARD',
      reason: 'missing_shipping_data',
      totalWeightGrams: 0,
      packageLengthCm: 0,
      packageWidthCm: 0,
      packageHeightCm: 0,
    };
  }

  // Calculate package dimensions.
  const dimensions = calculatePackageDimensions(items);
  if (dimensions.lengthCm === -1) {
    return {
      available: false,
      price: null,
      isFree: false,
      zone: 'STANDARD',
      reason: 'missing_shipping_data',
      totalWeightGrams,
      packageLengthCm: 0,
      packageWidthCm: 0,
      packageHeightCm: 0,
    };
  }

  // Determine zone.
  const isCanary = isCanaryIslandsPostalCode(postalCode);
  const zone: 'STANDARD' | 'CANARY' = isCanary ? 'CANARY' : 'STANDARD';

  // Get the appropriate tier configuration for this zone.
  const config = isCanary ? SHIPPING_CONFIG.canary : SHIPPING_CONFIG.standard;

  // Determine applicable tier and price.
  let price: number | null = null;
  let reason: string | undefined;

  if (totalWeightGrams <= config.tier1.maxWeightGrams) {
    // Weight qualifies for Tier 1.
    if (fitsDimensions(dimensions, config.tier1.maxDimensionsCm)) {
      price = config.tier1.price;
    } else {
      // Weight is Tier 1, but dimensions exceed Tier 1 limit.
      // Tier 1 is the only tier for this weight, so shipping is unavailable.
      reason = 'dimensions_exceed_limit';
    }
  } else if (totalWeightGrams <= config.tier2.maxWeightGrams) {
    // Weight qualifies for Tier 2 (> 2kg and <= 5kg).
    if (fitsDimensions(dimensions, config.tier2.maxDimensionsCm)) {
      price = config.tier2.price;
    } else {
      reason = 'dimensions_exceed_limit';
    }
  } else {
    // Weight exceeds all tiers.
    reason = 'weight_exceeds_limit';
  }

  // If no price was determined, shipping is unavailable.
  if (price === null) {
    return {
      available: false,
      price: null,
      isFree: false,
      zone,
      reason: reason || 'unsupported',
      totalWeightGrams,
      packageLengthCm: dimensions.lengthCm,
      packageWidthCm: dimensions.widthCm,
      packageHeightCm: dimensions.heightCm,
    };
  }

  // Apply free-shipping threshold (standard only, not for Canary).
  let isFree = false;
  if (!isCanary && subtotalEur >= freeShippingThresholdEur) {
    isFree = true;
    price = 0;
  }

  return {
    available: true,
    price,
    isFree,
    zone,
    totalWeightGrams,
    packageLengthCm: dimensions.lengthCm,
    packageWidthCm: dimensions.widthCm,
    packageHeightCm: dimensions.heightCm,
  };
}

// Re-export for backward compatibility
export { isCanaryIslandsPostalCode };
