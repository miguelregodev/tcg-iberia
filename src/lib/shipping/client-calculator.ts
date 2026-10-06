/**
 * Client-side shipping cost calculator.
 * Lightweight version that doesn't depend on server-only modules.
 * Provides real-time shipping cost estimates based on postal code and cart items.
 */

import { isCanaryIslandsPostalCode } from './postal-codes';
import { SHIPPING_CONFIG, parseNumber } from './config';

export interface ClientShippingItem {
  quantity: number;
  weightGrams: number | null;
}

/**
 * Simplified shipping cost calculation for client-side use.
 * Estimates shipping based on zone and total weight without complex 3D packing.
 */
export function estimateShippingCost(
  items: ClientShippingItem[],
  postalCode: string
): number {
  if (!postalCode || !items.length) {
    return SHIPPING_CONFIG.standardShippingCost;
  }

  // Determine zone
  const isCanary = isCanaryIslandsPostalCode(postalCode);

  // Calculate total weight
  let totalWeight = 0;
  for (const item of items) {
    if (item.weightGrams) {
      totalWeight += item.weightGrams * item.quantity;
    }
  }

  // Get pricing tier based on weight
  const config = isCanary ? SHIPPING_CONFIG_CANARY : SHIPPING_CONFIG_STANDARD;

  if (totalWeight <= 2000) {
    return config.tier1;
  } else if (totalWeight <= 5000) {
    return config.tier2;
  } else {
    // Weight exceeds tiers, use highest tier
    return config.tier2;
  }
}

// Canary Islands shipping prices (higher due to distance)
const SHIPPING_CONFIG_CANARY = {
  tier1: parseNumber(process.env.NEXT_PUBLIC_SHIPPING_CANARY_TIER1, 10.99), // ≤2kg
  tier2: parseNumber(process.env.NEXT_PUBLIC_SHIPPING_CANARY_TIER2, 14.99), // 2-5kg
} as const;

// Standard zone shipping prices
const SHIPPING_CONFIG_STANDARD = {
  tier1: parseNumber(process.env.NEXT_PUBLIC_SHIPPING_STANDARD_TIER1, 3.99), // ≤2kg
  tier2: parseNumber(process.env.NEXT_PUBLIC_SHIPPING_STANDARD_TIER2, 4.99), // 2-5kg
} as const;
