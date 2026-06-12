'use client';

import { useEffect, useRef, useState } from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';

const SCROLL_STEP = 300;
const ANIMATION_MS = 400;

type Props = {
  endpoint: string;
};

// Reusable infinite-scroll product carousel.
// Strategy:
// - Render the products list 3 times (left buffer | visible middle | right buffer).
// - On mount, jump scrollLeft to the start of the middle copy.
// - Button clicks run a custom rAF easing animation against a tracked target
//   so rapid clicks accumulate deterministically.
// - Whenever the actual scrollLeft (or the pending target) leaves the middle
//   copy range, we instantly translate by ± one-copy-width. Because we never
//   set CSS `scroll-behavior: smooth`, those translations are jump cuts and
//   the wrap is invisible.
export function InfiniteProductCarousel({ endpoint }: Props) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const targetScrollRef = useRef<number | null>(null);
  const isWrappingRef = useRef(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const extendedProducts =
    products.length > 0 ? [...products, ...products, ...products] : [];

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setProducts(data);
        }
      } catch (error) {
        console.error('Failed to fetch products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Center on the middle copy whenever the product list (re)loads.
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || products.length === 0) return;

    const center = () => {
      const oneCopy = el.scrollWidth / 3;
      el.scrollLeft = oneCopy;
      targetScrollRef.current = null;
    };

    // Wait one frame so layout has settled and scrollWidth is accurate.
    const id = requestAnimationFrame(center);
    return () => cancelAnimationFrame(id);
  }, [products]);

  // Cancel any in-flight animation on unmount.
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const wrapIfNeeded = (el: HTMLDivElement) => {
    const oneCopy = el.scrollWidth / 3;
    if (el.scrollLeft < oneCopy * 0.5) {
      isWrappingRef.current = true;
      el.scrollLeft += oneCopy;
      if (targetScrollRef.current !== null) {
        targetScrollRef.current += oneCopy;
      }
      // Allow the next scroll event before clearing the flag.
      requestAnimationFrame(() => {
        isWrappingRef.current = false;
      });
    } else if (el.scrollLeft >= oneCopy * 2.5) {
      isWrappingRef.current = true;
      el.scrollLeft -= oneCopy;
      if (targetScrollRef.current !== null) {
        targetScrollRef.current -= oneCopy;
      }
      requestAnimationFrame(() => {
        isWrappingRef.current = false;
      });
    }
  };

  const animateTo = (el: HTMLDivElement, target: number) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startScroll = el.scrollLeft;
    const startTime = performance.now();
    const distance = target - startScroll;

    if (distance === 0) {
      animationFrameRef.current = null;
      return;
    }

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / ANIMATION_MS);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      // The target may have shifted because of a wrap; recompute relative to
      // the (possibly updated) targetScrollRef instead of the stale `target`.
      const liveTarget = targetScrollRef.current ?? target;
      const liveDistance = liveTarget - startScroll;
      el.scrollLeft = startScroll + liveDistance * eased;

      // Wrap mid-animation if we've drifted outside the safe range. We
      // re-baseline startScroll so the rest of the animation continues
      // smoothly from the new position.
      const oneCopy = el.scrollWidth / 3;
      if (el.scrollLeft < oneCopy * 0.5 || el.scrollLeft >= oneCopy * 2.5) {
        wrapIfNeeded(el);
      }

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
        wrapIfNeeded(el);
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  const scrollByStep = (delta: number) => {
    const el = carouselRef.current;
    if (!el || products.length === 0) return;

    const base = targetScrollRef.current ?? el.scrollLeft;
    let target = base + delta;

    const oneCopy = el.scrollWidth / 3;
    // Pre-wrap the target so the animation always heads to a position inside
    // the safe range. The actual scrollLeft is wrapped by wrapIfNeeded.
    if (target < oneCopy * 0.5) {
      isWrappingRef.current = true;
      el.scrollLeft += oneCopy;
      target += oneCopy;
      requestAnimationFrame(() => {
        isWrappingRef.current = false;
      });
    } else if (target >= oneCopy * 2.5) {
      isWrappingRef.current = true;
      el.scrollLeft -= oneCopy;
      target -= oneCopy;
      requestAnimationFrame(() => {
        isWrappingRef.current = false;
      });
    }

    targetScrollRef.current = target;
    animateTo(el, target);
  };

  const handleScrollLeft = () => scrollByStep(-SCROLL_STEP);
  const handleScrollRight = () => scrollByStep(SCROLL_STEP);

  // Catches wheel / touch / trackpad scrolls that drift outside the middle copy.
  const handleScroll = () => {
    const el = carouselRef.current;
    if (!el || products.length === 0) return;
    if (isWrappingRef.current) return;
    if (animationFrameRef.current !== null) return; // animation handles its own wraps
    wrapIfNeeded(el);
  };

  if (loading) {
    return (
      <section id="catalog" className="section">
        <div className="container-custom">
          <div className="h-64" aria-busy="true" />
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section id="catalog" className="section">
        <div className="container-custom">
          <p className="text-center text-gray-600">No products available</p>
        </div>
      </section>
    );
  }

  return (
    <section id="catalog" className="section">
      <div className="container-custom">
        <div className="relative">
          <button
            type="button"
            onClick={handleScrollLeft}
            aria-label="Scroll left"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
          >
            <img
              src="/images/left-arrow.png"
              alt=""
              className="w-6 h-6 bg-white/80 hover:bg-white shadow-md rounded-full transition"
            />
          </button>
          <button
            type="button"
            onClick={handleScrollRight}
            aria-label="Scroll right"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
          >
            <img
              src="/images/right-arrow.png"
              alt=""
              className="w-6 h-6 bg-white/80 hover:bg-white shadow-md rounded-full transition"
            />
          </button>
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex gap-6 overflow-x-auto no-scrollbar"
          >
            {extendedProducts.map((product, index) => (
              <div key={`${product.id}-${index}`} className="min-w-[280px]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
