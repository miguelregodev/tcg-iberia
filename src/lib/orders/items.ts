import type { Product } from '@/types';

export interface OrderItemSnapshot {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number;
  imageUrl?: string;
  releaseDate?: string | null;
  isPreorder?: boolean;
}

export type OrderItemVariant = 'sealed' | 'live';

export const ORDER_ITEM_VARIANT_LABEL: Record<OrderItemVariant, string> = {
  sealed: 'Sellado',
  live: 'Apertura en Directo',
};

// Live-opening lines are stored with a `_live` suffix on the product id.
export function getOrderItemVariant(item: { id?: string | null }): OrderItemVariant {
  return item.id?.endsWith('_live') ? 'live' : 'sealed';
}

export function createOrderItemSnapshot(
  product: Product,
  quantity: number,
): OrderItemSnapshot {
  return {
    id: product.id,
    name: product.name,
    quantity,
    price: Number(product.price),
    discountPercentage: product.discountPercentage ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
    releaseDate: product.releaseDate,
    isPreorder: product.isPreorder,
  };
}

export function isOrderItemSnapshot(value: unknown): value is OrderItemSnapshot {
  if (!value || typeof value !== 'object') return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.price === 'number'
  );
}