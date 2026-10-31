import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types';
import { fetchAllSearchProducts } from './search-client';
import { filterAndSortByPrice, getCatalogPrice } from './price-filter';

afterEach(() => vi.unstubAllGlobals());

describe('fetchAllSearchProducts', () => {
  it('loads every page in relevance order before filtering and sorting by price', async () => {
    const products = Array.from({ length: 150 }, (_, index): Product => ({
      id: String(index),
      name: `Box ${index}`,
      slug: String(index),
      description: '',
      price: index,
      discountPercentage: null,
      liveOpeningPrice: null,
      b2bPrice: null,
      notes: null,
      type: 'Booster Box',
      releaseDate: null,
      stock: 10,
      imageUrl: null,
      language: 'JAPANESE',
      priority: index,
      visible: true,
      available: true,
      canPurchase: true,
      isPreorder: false,
      inventoryStatus: 'available',
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      createdAt: '',
      updatedAt: '',
    }));
    const fetchMock = vi.fn(async (input: string) => {
      const params = new URL(input, 'http://localhost').searchParams;
      const offset = Number(params.get('offset'));
      return Response.json({ products: products.slice(offset, offset + 100), total: 150 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    const result = await fetchAllSearchProducts('booster box', signal);
    expect(result).toEqual({ products, total: 150 });
    expect(fetchMock.mock.calls.map(([input]) => new URL(input, 'http://localhost').searchParams.get('offset')))
      .toEqual(['0', '100']);
    expect(fetchMock.mock.calls.every(([input]) => new URL(input, 'http://localhost').searchParams.get('q') === 'booster box'))
      .toBe(true);
    expect(filterAndSortByPrice(result.products, { minPrice: 120, maxPrice: 125, sort: 'price-desc' }, getCatalogPrice)
      .map((product) => product.price)).toEqual([125, 124, 123, 122, 121, 120]);
  });

  it('returns an empty result without making extra requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ products: [], total: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAllSearchProducts('missing', new AbortController().signal))
      .resolves.toEqual({ products: [], total: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed request instead of returning partial results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(fetchAllSearchProducts('box', new AbortController().signal)).rejects.toThrow('Search failed (500)');
  });

  it('surfaces incomplete pagination instead of silently excluding matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ products: [], total: 150 })));
    await expect(fetchAllSearchProducts('box', new AbortController().signal)).rejects.toThrow('empty page');
  });

  it('does not fetch when the request is already aborted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchAllSearchProducts('box', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
