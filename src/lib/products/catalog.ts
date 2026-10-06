import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import type { Product } from '@/types';
import {
  publicProductSelect,
  publicProductWithHitCardsSelect,
  serializePublicProduct,
} from './serialization';

/** Seconds a cached catalog snapshot may be served before refetching. */
const CATALOG_REVALIDATE_SECONDS = 60;

const loadPublicCatalog = unstable_cache(
  async (): Promise<Product[]> => {
    const rows = await db.product.findMany({
      where: { visible: true },
      orderBy: { priority: 'asc' },
      select: publicProductSelect,
    });
    return rows.map(serializePublicProduct);
  },
  ['public-catalog'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['products'] },
);

/** All visible products (public shape, no B2B prices), shared by listings, sitemap and related-products. */
export async function getPublicCatalog(): Promise<Product[]> {
  return loadPublicCatalog();
}

/** Visible product by slug including hit cards, or `null` when missing/hidden. Deduped per request. */
export const getPublicProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const row = await db.product.findUnique({
    where: { slug },
    select: publicProductWithHitCardsSelect,
  });
  if (!row || !row.visible) return null;
  return serializePublicProduct(row);
});
