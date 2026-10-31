import type { Product } from '@/types';

export type PriceSort = 'default' | 'price-asc' | 'price-desc';

export interface CatalogPriceOptions {
  minPrice: number | null;
  maxPrice: number | null;
  sort: PriceSort;
}

export interface CatalogPriceBounds {
  min: number;
  max: number;
}

export function getCatalogPriceBounds<T>(
  products: T[],
  getPrice: (product: T) => number,
): CatalogPriceBounds | null {
  if (products.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const product of products) {
    const price = getPrice(product);
    min = Math.min(min, price);
    max = Math.max(max, price);
  }
  return { min, max };
}

export const DEFAULT_PRICE_OPTIONS: CatalogPriceOptions = {
  minPrice: null,
  maxPrice: null,
  sort: 'default',
};

export function getPublicPriceDetails(
  product: Pick<Product, 'price' | 'discountPercentage' | 'liveOpeningPrice'>,
) {
  const discounted = !!product.discountPercentage && product.discountPercentage > 0;
  const multiplier = discounted ? 1 - (product.discountPercentage ?? 0) / 100 : 1;
  const hasLiveOpening = product.liveOpeningPrice != null;
  const sealedFinal = product.price * multiplier;
  const liveFinal = product.liveOpeningPrice != null ? product.liveOpeningPrice * multiplier : null;
  const useLive = liveFinal != null && liveFinal <= sealedFinal;
  const originalPrice = useLive && product.liveOpeningPrice != null ? product.liveOpeningPrice : product.price;
  return { discounted, hasLiveOpening, originalPrice, displayPrice: useLive && liveFinal != null ? liveFinal : sealedFinal };
}

export function getCatalogPrice(
  product: Pick<Product, 'price' | 'discountPercentage' | 'liveOpeningPrice'>,
  wholesalePrice?: number | null,
): number {
  const price = wholesalePrice != null && wholesalePrice > 0
    ? wholesalePrice
    : getPublicPriceDetails(product).displayPrice;
  // Compare the cents customers actually see, not hidden fractional cents.
  return Number(price.toFixed(2));
}

export function validatePriceRange(minPrice: number | null, maxPrice: number | null): string | null {
  if ([minPrice, maxPrice].some((value) => value != null && (!Number.isFinite(value) || value < 0))) {
    return 'Introduce precios válidos iguales o mayores que cero.';
  }
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return 'El precio mínimo no puede superar el máximo.';
  }
  return null;
}

export function filterAndSortByPrice<T>(
  products: T[],
  options: CatalogPriceOptions,
  getPrice: (product: T) => number,
): T[] {
  const priced = products.map((product) => ({ product, price: getPrice(product) }));
  const filtered = priced.filter(({ price }) =>
    (options.minPrice == null || price >= options.minPrice)
    && (options.maxPrice == null || price <= options.maxPrice),
  );
  if (options.sort !== 'default') {
    const direction = options.sort === 'price-asc' ? 1 : -1;
    filtered.sort((a, b) => direction * (a.price - b.price));
  }
  return filtered.map(({ product }) => product);
}
