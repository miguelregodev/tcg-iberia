/**
 * Resolves the final shipping cost to charge from a shipping-calculator result,
 * falling back to the flat standard cost (respecting the free-shipping threshold)
 * when the weight/dimension-based calculation is unavailable (e.g. missing product
 * shipping data). Shared by checkout order creation and grouped-shipment requests
 * so both paths apply the exact same business rule.
 */
import { calculateShippingCost, ShippingItem } from './shipping-calculator';
import { isCanaryIslandsPostalCode } from './postal-codes';
import { SHIPPING_CONFIG } from './config';

export function resolveShippingCost(
  items: ShippingItem[],
  postalCode: string,
  subtotal: number,
  freeShippingThreshold: number = SHIPPING_CONFIG.freeShippingThreshold,
  fallbackStandardCost: number = SHIPPING_CONFIG.standardShippingCost
): number {
  const result = calculateShippingCost(items, postalCode, subtotal, freeShippingThreshold);

  if (result.available) {
    return result.price ?? 0;
  }

  const qualifiesForFreeShipping =
    !isCanaryIslandsPostalCode(postalCode) && subtotal >= freeShippingThreshold;
  return qualifiesForFreeShipping ? 0 : fallbackStandardCost;
}
