'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { formatReleaseDate, getProductInventoryState, getProductPurchaseLabel, getProductQuantityLimit, getProductStatusLabel } from '@/lib/products/state';

const SCROLL_STEP = 300;
const ANIMATION_MS = 400;

type Props = {
  excludeId?: string;
  limit?: number;
  title?: string;
  subtitle?: string;
};

function getLanguageFlag(language: string): { path: string; name: string } {
  const flags: Record<string, { path: string; name: string }> = {
    ENGLISH: { path: '/images/united-kingdom.png', name: 'English' },
    JAPANESE: { path: '/images/japan.png', name: 'Japanese' },
    KOREAN: { path: '/images/south-korea.png', name: 'Korean' },
    SPANISH: { path: '/images/spain.png', name: 'Spanish' },
  };
  return flags[language] || flags.ENGLISH;
}

function SuggestionCard({ product }: { product: Product }) {
  const { addToCart, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const flagInfo = getLanguageFlag(product.language);
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const releaseDate = formatReleaseDate(product.releaseDate);

  const inCartQuantity =
    items.find((it) => it.product.id === product.id)?.quantity ?? 0;
  const quantityLimit = getProductQuantityLimit(inventoryState);
  const reachedMax = quantityLimit !== null && inCartQuantity >= quantityLimit;
  const isSoldOut = !inventoryState.canPurchase;

  const finalPrice = product.discountPercentage
    ? Number(product.price) * (1 - Number(product.discountPercentage) / 100)
    : Number(product.price);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSoldOut || reachedMax) return;
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  const buttonDisabled = isSoldOut || reachedMax;
  const buttonLabel = isSoldOut
    ? 'Agotado'
    : reachedMax
    ? 'Sin más stock'
    : justAdded
    ? '\u2713 Añadido'
    : getProductPurchaseLabel(inventoryState);

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden w-full h-full">
      <Link href={`/product/${product.slug}`} className="flex flex-col flex-1">
        <div className="relative h-48 bg-gray-50 overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gray-100" />
          )}
          <div className="absolute top-3 left-3 bg-white rounded-lg p-1.5 shadow-md">
            <img
              src={flagInfo.path}
              alt={flagInfo.name}
              title={flagInfo.name}
              className="w-6 h-4 object-cover rounded"
            />
          </div>
          {product.discountPercentage ? (
            <div className="absolute top-3 right-3 bg-red-600 text-white px-2.5 py-1 rounded-full font-bold text-xs shadow-md">
              -{Number(product.discountPercentage)}%
            </div>
          ) : null}
        </div>
        <div className="p-4 flex flex-col gap-2 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors h-10">
            {product.name}
          </h3>
          {inventoryState.isPreorder && releaseDate ? (
            <p className="text-xs font-semibold text-gray-600">
              Lanzamiento: {releaseDate}
            </p>
          ) : null}
          <div className="flex items-baseline gap-2 h-7">
            <span className="text-lg font-bold text-black">
              {finalPrice.toFixed(2)}€
            </span>
            {product.discountPercentage ? (
              <span className="text-xs text-gray-400 line-through">
                {Number(product.price).toFixed(2)}€
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4">
        <p className={`mb-2 text-xs font-semibold ${
          inventoryState.status === 'preorder'
            ? 'text-blue-700'
            : inventoryState.status === 'available'
            ? 'text-green-600'
            : inventoryState.status === 'low_stock'
            ? 'text-orange-600'
            : 'text-red-600'
        }`}>
          {getProductStatusLabel(inventoryState)}
        </p>
        <button
          type="button"
          onClick={handleAdd}
          disabled={buttonDisabled}
          className={`w-full font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
            buttonDisabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : justAdded
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md'
          }`}
        >
          {!buttonDisabled && !justAdded && (
            <img
              src="/images/add-to-cart.png"
              alt=""
              className="w-4 h-4"
            />
          )}
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export function CompleteYourPurchase({
  excludeId,
  limit = 12,
  title = 'Completa tu compra',
  subtitle = 'Otros productos que podrían interesarte',
}: Props) {
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
        const params = new URLSearchParams();
        if (excludeId) params.set('excludeId', excludeId);
        params.set('limit', String(limit));
        const response = await fetch(`/api/products/random?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setProducts(data);
        }
      } catch (error) {
        console.error('Failed to fetch suggested products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [excludeId, limit]);

  // Center on the middle copy whenever the product list (re)loads.
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || products.length === 0) return;

    const center = () => {
      const oneCopy = el.scrollWidth / 3;
      el.scrollLeft = oneCopy;
      targetScrollRef.current = null;
    };

    const id = requestAnimationFrame(center);
    return () => cancelAnimationFrame(id);
  }, [products]);

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
      const eased = 1 - Math.pow(1 - t, 3);

      const liveTarget = targetScrollRef.current ?? target;
      const liveDistance = liveTarget - startScroll;
      el.scrollLeft = startScroll + liveDistance * eased;

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

  const handleScroll = () => {
    const el = carouselRef.current;
    if (!el || products.length === 0) return;
    if (isWrappingRef.current) return;
    if (animationFrameRef.current !== null) return;
    wrapIfNeeded(el);
  };

  if (loading) {
    return (
      <section className="py-12">
        <div className="container-custom px-4">
          <div className="h-64" aria-busy="true" />
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 border-t border-gray-200">
      <div className="container-custom px-4">
        <div className="mb-8 text-center">
          <h2 className="font-airstrike text-2xl md:text-4xl uppercase tracking-wider text-black">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm md:text-base text-gray-500">{subtitle}</p>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={handleScrollLeft}
            aria-label="Scroll left"
            className="absolute -left-2 md:-left-4 top-1/2 -translate-y-1/2 z-10"
          >
            <img
              src="/images/left-arrow.png"
              alt=""
              className="w-8 h-8 bg-white shadow-md rounded-full hover:scale-110 transition"
            />
          </button>
          <button
            type="button"
            onClick={handleScrollRight}
            aria-label="Scroll right"
            className="absolute -right-2 md:-right-4 top-1/2 -translate-y-1/2 z-10"
          >
            <img
              src="/images/right-arrow.png"
              alt=""
              className="w-8 h-8 bg-white shadow-md rounded-full hover:scale-110 transition"
            />
          </button>

          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-2 items-stretch"
          >
            {extendedProducts.map((product, index) => (
              <div
                key={`${product.id}-${index}`}
                className="flex-shrink-0 w-[220px] md:w-[260px] h-[420px] flex"
              >
                <SuggestionCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
