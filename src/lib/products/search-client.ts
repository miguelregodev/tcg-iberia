import type { Product } from '@/types';
import { SEARCH_MAX_LIMIT, type SearchResponse } from '@/lib/products/search';

export async function fetchAllSearchProducts(
  query: string,
  signal: AbortSignal,
): Promise<Pick<SearchResponse, 'products' | 'total'>> {
  const params = new URLSearchParams({ q: query, limit: String(SEARCH_MAX_LIMIT) });
  const products: Product[] = [];
  let total = 0;
  do {
    signal.throwIfAborted();
    params.set('offset', String(products.length));
    const response = await fetch(`/api/search?${params.toString()}`, { signal });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    const data = (await response.json()) as SearchResponse;
    signal.throwIfAborted();
    total = data.total;
    if (data.products.length === 0 && products.length < total) {
      throw new Error('Search pagination returned an empty page before all matches were loaded');
    }
    products.push(...data.products);
  } while (products.length < total);
  return { products, total };
}
