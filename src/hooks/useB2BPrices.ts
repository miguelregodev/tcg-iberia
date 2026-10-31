'use client';

/**
 * useB2BPrices
 *
 * Fetches wholesale price overrides for the given product IDs when the user
 * has an ACTIVE B2B session. Returns a Map<productId, { b2bPrice }>.
 *
 * When there's no active B2B session, returns an empty Map immediately and
 * makes no network request — safe to call from any product listing.
 *
 * The IDs list is compared by value (stringified + sorted) so callers can
 * pass a freshly-mapped array on every render without triggering re-fetches.
 */

import { useEffect, useMemo, useState } from 'react';
import { useB2BSession } from '@/context/B2BSessionContext';

export interface B2BPriceOverride {
  b2bPrice: number | null;
}

export async function fetchB2BPriceOverrides(
  productIds: string[],
  signal: AbortSignal,
): Promise<Map<string, B2BPriceOverride>> {
  // Match the maximum IDs accepted by /api/b2b/prices.
  const batchSize = 200;
  const requests: Promise<Record<string, B2BPriceOverride>>[] = [];
  for (let offset = 0; offset < productIds.length; offset += batchSize) {
    const ids = productIds.slice(offset, offset + batchSize).join(',');
    requests.push((async () => {
      const response = await fetch(`/api/b2b/prices?ids=${encodeURIComponent(ids)}`, {
        cache: 'no-store',
        credentials: 'include',
        signal,
      });
      if (!response.ok) throw new Error(`B2B price request failed (${response.status})`);
      const data = (await response.json()) as { prices: Record<string, B2BPriceOverride> };
      return data.prices;
    })());
  }
  const batches = await Promise.all(requests);
  return new Map(batches.flatMap((prices) => Object.entries(prices)));
}

export function useB2BPrices(productIds: string[]): Map<string, B2BPriceOverride> {
  const { isB2B } = useB2BSession();
  const [overrides, setOverrides] = useState<Map<string, B2BPriceOverride>>(new Map());

  // Stable key that only changes when the sorted list of IDs changes.
  const stableKey = useMemo(() => {
    return [...productIds]
      .filter(Boolean)
      .sort()
      .join(',');
  }, [productIds]);

  useEffect(() => {
    if (!isB2B || stableKey === '') {
      setOverrides(new Map());
      return;
    }
    const controller = new AbortController();

    (async () => {
      try {
        const next = await fetchB2BPriceOverrides(stableKey.split(','), controller.signal);
        if (!controller.signal.aborted) setOverrides(next);
        
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch B2B prices:', err);
          setOverrides(new Map());
        }
      }
    })();

    return () => controller.abort();
  }, [isB2B, stableKey]);

  return overrides;
}

/**
 * Return the effective price for a product given the active B2B override map.
 * Falls back to the public price when no B2B override exists.
 */
export function resolveEffectivePrice(params: {
  productId: string;
  publicPrice: number;
  overrides: Map<string, B2BPriceOverride>;
}): { price: number; isB2B: boolean } {
  const o = params.overrides.get(params.productId);
  const override = o?.b2bPrice ?? null;
  if (override !== null && override > 0) {
    return { price: override, isB2B: true };
  }
  return { price: params.publicPrice, isB2B: false };
}
