import { SHIPPING_CONFIG } from './config';

export interface PricedItem {
  price: number;
  quantity: number;
  discountPercentage?: number | null;
}

export interface FreeShippingState {
  threshold: number;
  cartValue: number;
  shippingCost: number;
  remainingAmount: number;
  percentage: number;
  qualified: boolean;
}

export function getDiscountedUnitPrice(item: Pick<PricedItem, 'price' | 'discountPercentage'>): number {
  const price = Number(item.price) || 0;
  const discount = Number(item.discountPercentage ?? 0);
  if (!discount || discount <= 0) return price;
  return price * (1 - discount / 100);
}

export function calculateSubtotal(items: PricedItem[]): number {
  return items.reduce((sum, item) => {
    const unitPrice = getDiscountedUnitPrice(item);
    return sum + unitPrice * item.quantity;
  }, 0);
}

export function getFreeShippingState(
  cartValue: number,
  threshold = SHIPPING_CONFIG.freeShippingThreshold,
  standardShippingCost = SHIPPING_CONFIG.standardShippingCost
): FreeShippingState {
  const safeCartValue = Math.max(0, Number(cartValue) || 0);
  const safeThreshold = Math.max(0, Number(threshold) || 0);
  const qualified = safeThreshold === 0 || safeCartValue >= safeThreshold;
  const remainingAmount = qualified ? 0 : safeThreshold - safeCartValue;
  const percentage =
    safeThreshold <= 0
      ? 100
      : Math.min(100, Math.max(0, (safeCartValue / safeThreshold) * 100));

  return {
    threshold: safeThreshold,
    cartValue: safeCartValue,
    shippingCost: qualified ? 0 : Math.max(0, Number(standardShippingCost) || 0),
    remainingAmount,
    percentage,
    qualified,
  };
}
