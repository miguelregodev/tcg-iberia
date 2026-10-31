import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchB2BPriceOverrides } from './useB2BPrices';

afterEach(() => vi.unstubAllGlobals());

describe('fetchB2BPriceOverrides', () => {
  it('fetches all wholesale prices without exceeding the API batch limit', async () => {
    const ids = Array.from({ length: 450 }, (_, index) => `product-${index}`);
    const batches: string[][] = [];
    const fetchMock = vi.fn(async (input: string, options: RequestInit) => {
      const requestedIds = new URL(input, 'http://localhost').searchParams.get('ids')!.split(',');
      batches.push(requestedIds);
      expect(options.credentials).toBe('include');
      expect(options.cache).toBe('no-store');
      return Response.json({
        prices: Object.fromEntries(requestedIds.map((id) => [id, { b2bPrice: 25 }])),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    const prices = await fetchB2BPriceOverrides(ids, signal);
    expect(batches.map((batch) => batch.length)).toEqual([200, 200, 50]);
    expect(batches.flat()).toEqual(ids);
    expect(prices.size).toBe(450);
    expect(prices.get('product-449')).toEqual({ b2bPrice: 25 });
    expect(fetchMock.mock.calls.every(([, options]) => options.signal === signal)).toBe(true);
  });

  it('rejects a failed batch rather than returning incomplete wholesale prices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(fetchB2BPriceOverrides(['product'], new AbortController().signal))
      .rejects.toThrow('B2B price request failed (500)');
  });

  it('does not request prices for an empty list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchB2BPriceOverrides([], new AbortController().signal)).resolves.toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
