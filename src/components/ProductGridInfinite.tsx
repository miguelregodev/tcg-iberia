'use client';

import React, { memo } from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { PRODUCTS_PER_BATCH } from '@/hooks/useInfiniteReveal';

interface ProductGridInfiniteProps {
  /** Full filtered product array — this component slices it internally. */
  products: Product[];
  /** Number of items to render right now (managed by useInfiniteReveal). */
  visibleCount: number;
  /** Attach to the sentinel div that triggers the next batch. */
  sentinelRef: (node: HTMLDivElement | null) => void;
  /** Whether there are more items beyond the current visibleCount. */
  hasMore: boolean;
}

/**
 * Wraps a single ProductCard with the entrance animation.
 * Memoised so React never re-renders already-mounted cards when new batches
 * are appended — only genuinely new DOM nodes animate in.
 */
const AnimatedCard = memo(function AnimatedCard({
  product,
  animationDelay,
}: {
  product: Product;
  animationDelay: number;
}) {
  return (
    <div className="product-reveal" style={{ animationDelay: `${animationDelay}ms` }}>
      <ProductCard product={product} />
    </div>
  );
});

/**
 * Renders a responsive product grid with progressive reveal and entrance
 * animations. Pairs with `useInfiniteReveal` for scroll-driven batching.
 *
 * All products are already in memory — no extra API calls are made.
 */
export const ProductGridInfinite = memo(function ProductGridInfinite({
  products,
  visibleCount,
  sentinelRef,
  hasMore,
}: ProductGridInfiniteProps) {
  const visible = products.slice(0, visibleCount);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {visible.map((product, index) => {
          // Stagger delay within each batch: 0 → 60 → 120 … → max 600 ms.
          const delay = Math.min((index % PRODUCTS_PER_BATCH) * 60, 600);
          return (
            <AnimatedCard key={product.id} product={product} animationDelay={delay} />
          );
        })}
      </div>

      {/* Sentinel: IntersectionObserver watches this element to trigger the next batch */}
      {hasMore && (
        <div
          ref={sentinelRef}
          aria-hidden="true"
          className="flex justify-center pt-8 pb-2"
        >
          <span className="inline-flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-red-300 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        </div>
      )}
    </>
  );
});
