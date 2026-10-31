import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICE_OPTIONS,
  filterAndSortByPrice,
  getCatalogPrice,
  getCatalogPriceBounds,
  getPublicPriceDetails,
  validatePriceRange,
} from './price-filter';

describe('catalog display prices', () => {
  const product = { price: 100, discountPercentage: null, liveOpeningPrice: null };

  it('uses the public price without a discount or live-opening option', () => {
    expect(getCatalogPrice(product)).toBe(100);
  });

  describe('catalog slider bounds', () => {
    it('uses actual minimum and maximum prices, independent of catalog order', () => {
      expect(getCatalogPriceBounds([50, 10.25, 100.99, 40], (price) => price))
        .toEqual({ min: 10.25, max: 100.99 });
    });

    it('handles empty, single-price and free-product catalogs', () => {
      expect(getCatalogPriceBounds([], (price: number) => price)).toBeNull();
      expect(getCatalogPriceBounds([25, 25], (price) => price)).toEqual({ min: 25, max: 25 });
      expect(getCatalogPriceBounds([10, 0], (price) => price)).toEqual({ min: 0, max: 10 });
    });

    it('uses discounted and wholesale display prices for endpoints', () => {
      const products = [
        { price: 100, discountPercentage: 20, liveOpeningPrice: 50 },
        { price: 60, discountPercentage: null, liveOpeningPrice: null },
      ];
      expect(getCatalogPriceBounds(products, getCatalogPrice)).toEqual({ min: 40, max: 60 });
      expect(getCatalogPriceBounds(products, (product) => getCatalogPrice(product, 25)))
        .toEqual({ min: 25, max: 25 });
    });
  });

  it('applies discounts to the cheapest public variant', () => {
    expect(getCatalogPrice({ ...product, discountPercentage: 20 })).toBe(80);
    expect(getCatalogPrice({ ...product, discountPercentage: 20, liveOpeningPrice: 50 })).toBe(40);
    expect(getCatalogPrice({ ...product, discountPercentage: 20, liveOpeningPrice: 120 })).toBe(80);
    expect(getCatalogPrice({ ...product, liveOpeningPrice: 0 })).toBe(0);
  });

  it('keeps the price renderer original price and badges consistent', () => {
    expect(getPublicPriceDetails({ ...product, discountPercentage: 20, liveOpeningPrice: 50 }))
      .toEqual({ discounted: true, hasLiveOpening: true, originalPrice: 50, displayPrice: 40 });
  });

  it('uses wholesale prices without public discounts or live-opening prices', () => {
    expect(getCatalogPrice({ ...product, discountPercentage: 50, liveOpeningPrice: 10 }, 65)).toBe(65);
    expect(getCatalogPrice(product, 0)).toBe(100);
    expect(getCatalogPrice(product, null)).toBe(100);
  });

  it('compares the same rounded cents displayed on cards', () => {
    expect(getCatalogPrice({ ...product, price: 19.99, discountPercentage: 15 })).toBe(16.99);
    expect(getCatalogPrice(product, 65.555)).toBe(Number((65.555).toFixed(2)));
  });
});

describe('price range validation', () => {
  it('allows empty, one-sided, equal, and zero bounds', () => {
    for (const [min, max] of [[null, null], [0, null], [null, 10], [10, 10], [0, 0]]) {
      expect(validatePriceRange(min, max)).toBeNull();
    }
  });

  it('rejects reversed, negative, and non-finite bounds with an explicit error', () => {
    for (const [min, max] of [[20, 10], [-1, null], [null, -1], [NaN, 10], [0, Infinity]]) {
      expect(validatePriceRange(min, max)).toEqual(expect.any(String));
    }
  });
});

describe('price filtering and sorting', () => {
  const products = [
    { id: 'first', price: 50 },
    { id: 'second', price: 10 },
    { id: 'third', price: 100 },
    { id: 'fourth', price: 50 },
    { id: 'free', price: 0 },
  ];
  const getPrice = (product: typeof products[number]) => product.price;

  it('preserves the original priority/relevance order by default', () => {
    expect(filterAndSortByPrice(products, DEFAULT_PRICE_OPTIONS, getPrice)).toEqual(products);
  });

  it('includes both bounds and supports one-sided ranges', () => {
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, minPrice: 10, maxPrice: 50 }, getPrice).map((p) => p.id))
      .toEqual(['first', 'second', 'fourth']);
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, minPrice: 50 }, getPrice).map((p) => p.id))
      .toEqual(['first', 'third', 'fourth']);
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, maxPrice: 0 }, getPrice).map((p) => p.id))
      .toEqual(['free']);
  });

  it('sorts in either direction, preserves ties, and does not mutate its source', () => {
    const original = [...products];
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, sort: 'price-asc' }, getPrice).map((p) => p.id))
      .toEqual(['free', 'second', 'first', 'fourth', 'third']);
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, sort: 'price-desc' }, getPrice).map((p) => p.id))
      .toEqual(['third', 'first', 'fourth', 'second', 'free']);
    expect(products).toEqual(original);
  });

  it('combines filtering and sorting and restores each independently', () => {
    const options = { minPrice: 10, maxPrice: 50, sort: 'price-asc' as const };
    expect(filterAndSortByPrice(products, options, getPrice).map((p) => p.id)).toEqual(['second', 'first', 'fourth']);
    expect(filterAndSortByPrice(products, { ...options, sort: 'default' }, getPrice).map((p) => p.id)).toEqual(['first', 'second', 'fourth']);
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, sort: options.sort }, getPrice)).toHaveLength(5);
    expect(filterAndSortByPrice(products, DEFAULT_PRICE_OPTIONS, getPrice)).toEqual(products);
  });

  it('filters the full catalog before slicing progressive batches', () => {
    const fullCatalog = Array.from({ length: 150 }, (_, index) => ({ id: String(index), price: index }));
    const filtered = filterAndSortByPrice(fullCatalog, { minPrice: 120, maxPrice: 140, sort: 'price-desc' }, getPrice);
    expect(filtered).toHaveLength(21);
    expect(filtered.slice(0, 16).map((p) => p.price)).toEqual(Array.from({ length: 16 }, (_, index) => 140 - index));
  });

  it('returns an empty list for ranges without matches', () => {
    expect(filterAndSortByPrice(products, { ...DEFAULT_PRICE_OPTIONS, minPrice: 101 }, getPrice)).toEqual([]);
  });
});
