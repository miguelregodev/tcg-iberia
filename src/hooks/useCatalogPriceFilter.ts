'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Product } from '@/types';
import type { B2BPriceOverride } from '@/hooks/useB2BPrices';
import {
  DEFAULT_PRICE_OPTIONS,
  filterAndSortByPrice,
  getCatalogPrice,
  getCatalogPriceBounds,
  type CatalogPriceBounds,
  type CatalogPriceOptions,
} from '@/lib/products/price-filter';

interface UseCatalogPriceFilterResult {
  visibleProducts: Product[];
  priceOptions: CatalogPriceOptions;
  setPriceOptions: Dispatch<SetStateAction<CatalogPriceOptions>>;
  hasPriceFilter: boolean;
  priceKey: string;
  priceBounds: CatalogPriceBounds | null;
}

export function useCatalogPriceFilter(
  products: Product[],
  overrides?: ReadonlyMap<string, B2BPriceOverride>,
): UseCatalogPriceFilterResult {
  const [priceOptions, setPriceOptions] = useState<CatalogPriceOptions>(DEFAULT_PRICE_OPTIONS);
  const priceBounds = useMemo(
    () => getCatalogPriceBounds(products, (product) =>
      getCatalogPrice(product, overrides?.get(product.id)?.b2bPrice),
    ),
    [products, overrides],
  );
  const visibleProducts = useMemo(
    () => filterAndSortByPrice(products, priceOptions, (product) =>
      getCatalogPrice(product, overrides?.get(product.id)?.b2bPrice),
    ),
    [products, priceOptions, overrides],
  );
  const hasPriceFilter = priceOptions.minPrice != null || priceOptions.maxPrice != null;
  const priceKey = `${priceOptions.minPrice ?? ''}:${priceOptions.maxPrice ?? ''}:${priceOptions.sort}`;

  return { visibleProducts, priceOptions, setPriceOptions, hasPriceFilter, priceKey, priceBounds };
}
