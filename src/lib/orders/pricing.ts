import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { OrderItemSnapshot } from './items';

// Cart ids for the live-opening variant carry a `_live` suffix over the real product id.
export function getBaseProductId(id: string): string {
  return id.replace(/_live$/, '');
}

export type PricedOrderItemsResult =
  | {
      ok: true;
      items: OrderItemSnapshot[];
      products: Array<{
        id: string;
        weightGrams: number | null;
        lengthCm: Prisma.Decimal | null;
        widthCm: Prisma.Decimal | null;
        heightCm: Prisma.Decimal | null;
      }>;
    }
  | { ok: false; error: string };

/** Maps priced items to the weight/dimension inputs of the zone-based shipping calculator. */
export function toShippingItems(
  items: OrderItemSnapshot[],
  products: Extract<PricedOrderItemsResult, { ok: true }>['products'],
) {
  return items.map((item) => {
    const product = products.find((p) => p.id === getBaseProductId(item.id));
    return {
      quantity: item.quantity,
      weightGrams: product?.weightGrams || null,
      lengthCm: product?.lengthCm || null,
      widthCm: product?.widthCm || null,
      heightCm: product?.heightCm || null,
    };
  });
}

/**
 * Replaces client-supplied price and discount with current database values so that
 * checkout totals never depend on what the browser sent.
 */
export async function priceOrderItems(items: OrderItemSnapshot[]): Promise<PricedOrderItemsResult> {
  if (!items.every((item) => Number.isInteger(item.quantity) && item.quantity > 0)) {
    return { ok: false, error: 'Invalid item quantity' };
  }

  const productIds = Array.from(new Set(items.map((item) => getBaseProductId(item.id))));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      visible: true,
      price: true,
      liveOpeningPrice: true,
      discountPercentage: true,
      weightGrams: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
    },
  });

  const pricedItems: OrderItemSnapshot[] = [];
  for (const item of items) {
    const product = products.find((p) => p.id === getBaseProductId(item.id));
    const basePrice = item.id.endsWith('_live') ? product?.liveOpeningPrice : product?.price;
    if (!product || !product.visible || basePrice == null) {
      return { ok: false, error: `Product no longer available: ${item.name}` };
    }
    pricedItems.push({
      ...item,
      price: parseFloat(basePrice.toString()),
      discountPercentage:
        product.discountPercentage != null
          ? parseFloat(product.discountPercentage.toString())
          : undefined,
    });
  }

  return { ok: true, items: pricedItems, products };
}
