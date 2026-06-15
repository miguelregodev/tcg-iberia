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