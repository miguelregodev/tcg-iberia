'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/types';
import {
  SEARCH_MIN_QUERY_LENGTH,
  type SearchResponse,
  tokenize,
} from '@/lib/products/search';

export type ProductSearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseProductSearchOptions {
  /** Raw user-typed query. */
  query: string;
  /** Live-search limit (defaults to 5). */
  limit?: number;
  /** Debounce delay in ms (defaults to 300). */
  debounceMs?: number;
  /** Disable network calls (e.g. when the search panel is closed). */
  enabled?: boolean;
}

export interface UseProductSearchResult {
  status: ProductSearchStatus;
  products: Product[];
  total: number;
  /** The query string that produced the current `products` array. */
  resolvedQuery: string;
  error: string | null;
}

/**
 * Debounced, abortable product search hook.
 *
 * - Skips empty / too-short queries.
 * - Cancels stale requests via `AbortController`.
 * - Returns the products from the most recent **successful** query so the UI
 *   never flashes empty between keystrokes.
 */
export function useProductSearch({
  query,
  limit = 5,
  debounceMs = 300,
  enabled = true,
}: UseProductSearchOptions): UseProductSearchResult {
  const [status, setStatus] = useState<ProductSearchStatus>('idle');
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Track the most recent controller so a follow-up effect can abort it.
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Reset to idle when the panel closes.
      controllerRef.current?.abort();
      controllerRef.current = null;
      setStatus('idle');
      setProducts([]);
      setTotal(0);
      setResolvedQuery('');
      setError(null);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_QUERY_LENGTH || tokenize(trimmed).length === 0) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setStatus('idle');
      setProducts([]);
      setTotal(0);
      setResolvedQuery('');
      setError(null);
      return;
    }

    setStatus('loading');

    const handle = setTimeout(async () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: String(limit),
        });
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Search request failed (${res.status})`);
        }
        const data = (await res.json()) as SearchResponse;
        if (controller.signal.aborted) return;
        setProducts(data.products);
        setTotal(data.total);
        setResolvedQuery(trimmed);
        setError(null);
        setStatus('success');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Search failed';
        setError(message);
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      clearTimeout(handle);
    };
  }, [query, limit, debounceMs, enabled]);

  // Final unmount cleanup
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return { status, products, total, resolvedQuery, error };
}
