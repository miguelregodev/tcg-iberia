'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const INITIAL_PRODUCTS = 16;
export const PRODUCTS_PER_BATCH = 12;

const SNAPSHOT_PREFIX = 'tcg-list-snapshot:';
// The list re-mounts a moment after the browser's popstate; allow for a slow route fetch.
const BACK_NAVIGATION_WINDOW_MS = 10_000;

let lastPopStateAt = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    lastPopStateAt = Date.now();
  });
}

interface ListSnapshot {
  count: number;
  scrollY: number;
}

function takeSnapshot(key: string): ListSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_PREFIX + key);
    if (!raw) return null;
    sessionStorage.removeItem(SNAPSHOT_PREFIX + key);
    if (Date.now() - lastPopStateAt > BACK_NAVIGATION_WINDOW_MS) return null;
    const parsed = JSON.parse(raw) as ListSnapshot;
    return Number.isFinite(parsed.count) && Number.isFinite(parsed.scrollY) ? parsed : null;
  } catch {
    return null;
  }
}

interface UseInfiniteRevealOptions {
  /** Total number of items in the full list. */
  total: number;
  initialCount?: number;
  batchSize?: number;
  /** Enables restoring the revealed count and scroll position after back navigation. */
  snapshotKey?: string;
}

interface UseInfiniteRevealReturn {
  /** How many items should currently be rendered. */
  visibleCount: number;
  /** Callback ref — attach to the sentinel element at the bottom of the grid. */
  sentinelRef: (node: HTMLDivElement | null) => void;
  /** True when there are more items to reveal. */
  hasMore: boolean;
  /** Call right before navigating away so the list can be restored on back navigation. */
  saveSnapshot: () => void;
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
  snapshotKey,
}: UseInfiniteRevealOptions): UseInfiniteRevealReturn {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const initialRestoreDone = useRef(false);
  const pendingScroll = useRef<ListSnapshot | null>(null);
  // Callback ref stores the sentinel DOM node as state so changes trigger the
  // observer effect (regular refs don't trigger effects on assignment).
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);

  const hasMore = visibleCount < total;

  // Reset when the underlying product list changes (e.g. language filter); the first
  // loaded list instead restores a saved snapshot when returning via back navigation.
  useEffect(() => {
    if (!initialRestoreDone.current && total > 0) {
      initialRestoreDone.current = true;
      const snapshot = snapshotKey ? takeSnapshot(snapshotKey) : null;
      if (snapshot) {
        pendingScroll.current = snapshot;
        setVisibleCount(Math.min(Math.max(snapshot.count, initialCount), total));
        return;
      }
    }
    setVisibleCount(initialCount);
  }, [total, initialCount, snapshotKey]);

  // Scroll once the restored number of cards is actually rendered.
  useEffect(() => {
    const snapshot = pendingScroll.current;
    if (!snapshot || visibleCount < Math.min(snapshot.count, total)) return;
    pendingScroll.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: snapshot.scrollY, behavior: 'instant' });
    });
  }, [visibleCount, total]);

  const saveSnapshot = useCallback(() => {
    if (!snapshotKey) return;
    try {
      const snapshot: ListSnapshot = { count: visibleCount, scrollY: window.scrollY };
      sessionStorage.setItem(SNAPSHOT_PREFIX + snapshotKey, JSON.stringify(snapshot));
    } catch {
      // Storage unavailable (private mode / quota): the list simply starts from the top.
    }
  }, [snapshotKey, visibleCount]);

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

  return { visibleCount, sentinelRef, hasMore, saveSnapshot };
}
