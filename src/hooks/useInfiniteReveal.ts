'use client';

import { useCallback, useEffect, useState } from 'react';

export const INITIAL_PRODUCTS = 16;
export const PRODUCTS_PER_BATCH = 12;

interface UseInfiniteRevealOptions {
  /** Total number of items in the full list. */
  total: number;
  initialCount?: number;
  batchSize?: number;
}

interface UseInfiniteRevealReturn {
  /** How many items should currently be rendered. */
  visibleCount: number;
  /** Callback ref — attach to the sentinel element at the bottom of the grid. */
  sentinelRef: (node: HTMLDivElement | null) => void;
  /** True when there are more items to reveal. */
  hasMore: boolean;
}

/**
 * Manages progressive product revelation as the user scrolls.
 * All data is already fetched; this only controls client-side rendering.
 *
 * Uses IntersectionObserver to reveal additional batches when the sentinel
 * element at the end of the visible list enters the viewport.
 */
export function useInfiniteReveal({
  total,
  initialCount = INITIAL_PRODUCTS,
  batchSize = PRODUCTS_PER_BATCH,
}: UseInfiniteRevealOptions): UseInfiniteRevealReturn {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  // Callback ref stores the sentinel DOM node as state so changes trigger the
  // observer effect (regular refs don't trigger effects on assignment).
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);

  const hasMore = visibleCount < total;

  // Reset when the underlying product list changes (e.g. language filter).
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [total, initialCount]);

  const revealMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + batchSize, total));
  }, [batchSize, total]);

  // Stable callback ref — identity never changes, safe to use in JSX.
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinelEl(node);
  }, []);

  useEffect(() => {
    if (!sentinelEl || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          revealMore();
        }
      },
      // Trigger 200 px before the sentinel enters the viewport for a seamless feel.
      { rootMargin: '200px' }
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [sentinelEl, hasMore, revealMore]);

  return { visibleCount, sentinelRef, hasMore };
}
