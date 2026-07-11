'use client';

/**
 * useB2BPrices
 *
 * Fetches wholesale price overrides for the given product IDs when the user
 * has an ACTIVE B2B session. Returns a Map<productId, { b2bPrice, b2bPriceNoShrink }>.
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
  b2bPriceNoShrink: number | null;
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
        const res = await fetch(`/api/b2b/prices?ids=${encodeURIComponent(stableKey)}`, {
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) {
          setOverrides(new Map());
          return;
        }

        const data = (await res.json()) as { prices: Record<string, B2BPriceOverride> };
        const next = new Map<string, B2BPriceOverride>();
        for (const [id, values] of Object.entries(data.prices ?? {})) {
          next.set(id, values);
        }

        setOverrides(next);
        
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') {
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
 *
 * `variant` decides which slot is consulted; SHRINK uses `b2bPrice` and
 * NO_SHRINK uses `b2bPriceNoShrink`.
 */
export function resolveEffectivePrice(params: {
  productId: string;
  variant: 'SHRINK' | 'NO_SHRINK';
  publicPrice: number;
  overrides: Map<string, B2BPriceOverride>;
}): { price: number; isB2B: boolean } {
  const o = params.overrides.get(params.productId);
  const override =
    params.variant === 'SHRINK' ? o?.b2bPrice ?? null : o?.b2bPriceNoShrink ?? null;
  if (override !== null && override > 0) {
    return { price: override, isB2B: true };
  }
  return { price: params.publicPrice, isB2B: false };
}
