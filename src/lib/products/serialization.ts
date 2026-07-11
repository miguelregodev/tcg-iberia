import type { HitCard as PrismaHitCard, Prisma } from '@prisma/client';

import type { HitCard, Product } from '@/types';

import { getProductInventoryState } from './state';

export const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  discountPercentage: true,
  noShrinkPrice: true,
  notes: true,
  type: true,
  releaseDate: true,
  stock: true,
  noShrinkStock: true,
  imageUrl: true,
  language: true,
  priority: true,
  visible: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

export const publicProductWithHitCardsSelect = {
  ...publicProductSelect,
  hitCards: {
    orderBy: {
      createdAt: 'desc',
    },
  },
} satisfies Prisma.ProductSelect;

type ProductCoreShape = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: { toString(): string };
  discountPercentage: { toString(): string } | null;
  noShrinkPrice: { toString(): string } | null;
  notes: string | null;
  type: string | null;
  releaseDate: Date | null;
  stock: number;
  noShrinkStock: number;
  imageUrl: string | null;
  language: Product['language'];
  priority: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ProductWithOptionalHitCards = ProductCoreShape & {
  hitCards?: PrismaHitCard[];
};

function serializeHitCard(card: PrismaHitCard): HitCard {
  return {
    id: card.id,
    productId: card.productId,
    name: card.name,
    type: card.type,
    imageUrl: card.imageUrl,
    marketPrice: Number(card.marketPrice),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export function serializePublicProduct(
  product: ProductWithOptionalHitCards,
): Product {
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    discountPercentage: product.discountPercentage
      ? Number(product.discountPercentage)
      : null,
    noShrinkPrice: product.noShrinkPrice ? Number(product.noShrinkPrice) : null,
    // B2B pricing is intentionally NOT exposed by the public serializer to
    // avoid leaking wholesale rates to anonymous visitors. Consumers that
    // need the wholesale prices should call `/api/b2b/prices?ids=…` from
    // an authenticated B2B session — see `src/lib/b2b/prices.ts`.
    b2bPrice: null,
    b2bPriceNoShrink: null,
    notes: product.notes,
    type: product.type,
    releaseDate: inventoryState.releaseDate,
    stock: product.stock,
    noShrinkStock: product.noShrinkStock,
    imageUrl: product.imageUrl,
    language: product.language,
    priority: product.priority,
    visible: product.visible,
    available: inventoryState.canPurchase,
    canPurchase: inventoryState.canPurchase,
    isPreorder: inventoryState.isPreorder,
    inventoryStatus: inventoryState.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    hitCards: product.hitCards?.map(serializeHitCard),
  };
}