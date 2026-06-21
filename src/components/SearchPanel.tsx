'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Product } from '@/types';
import { useProductSearch } from '@/hooks/useProductSearch';
import { LIVE_SEARCH_LIMIT } from '@/lib/products/search';
import { trackProductSearch } from '@/lib/analytics/events';

/**
 * Imperative handle exposed to the parent so it can focus the input
 * the moment the panel opens (cannot use `autoFocus` reliably across the
 * mount/animation cycle).
 */
export interface SearchPanelHandle {
  focusInput: () => void;
}

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatPrice(value: number): string {
  return `${value.toFixed(2)}€`;
}

function computeDiscountedPrice(product: Product): number {
  if (product.discountPercentage == null) return product.price;
  return product.price * (1 - product.discountPercentage / 100);
}

/**
 * Single live-search result row. Memoised so the dropdown does not re-render
 * every row on highlight changes — we only re-render the affected ones.
 */
const SearchResultRow = function SearchResultRow({
  product,
  isActive,
  onMouseEnter,
  onSelect,
}: {
  product: Product;
  isActive: boolean;
  onMouseEnter: () => void;
  onSelect: () => void;
}) {
  const discounted = product.discountPercentage != null;
  const displayPrice = computeDiscountedPrice(product);

  return (
    <li role="option" aria-selected={isActive}>
      <Link
        href={`/product/${product.slug}`}
        onClick={onSelect}
        onMouseEnter={onMouseEnter}
        className={`flex items-center gap-4 px-4 py-3 transition-colors ${
          isActive ? 'bg-red-50' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex-shrink-0 w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
              IMG
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {product.name}
          </p>
          {product.type && (
            <p className="text-xs text-gray-500 truncate">{product.type}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          {discounted ? (
            <div className="flex flex-col items-end leading-tight">
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(product.price)}
              </span>
              <span className="text-sm font-bold text-red-600">
                {formatPrice(displayPrice)}
              </span>
            </div>
          ) : (
            <span className="text-sm font-bold text-red-600">
              {formatPrice(displayPrice)}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
};

export const SearchPanel = forwardRef<SearchPanelHandle, SearchPanelProps>(
  function SearchPanel({ open, onClose }, ref) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    // While the open/close height animation is running we must keep
    // `overflow-hidden` on the wrapper so the inner content clips smoothly.
    // Once the panel is fully open we switch to `overflow-visible` so the
    // absolutely-positioned results dropdown is not clipped by the wrapper.
    const [isAnimating, setIsAnimating] = useState(false);

    // Expose imperative focus to the parent (Navigation)
    useImperativeHandle(
      ref,
      () => ({
        focusInput: () => {
          inputRef.current?.focus();
          inputRef.current?.select();
        },
      }),
      [],
    );

    // Run live search; disabled when closed to release the controller.
    const { products, total, status } = useProductSearch({
      query,
      limit: LIVE_SEARCH_LIMIT,
      enabled: open,
    });

    // Reset transient UI state every time the panel closes.
    useEffect(() => {
      if (!open) {
        setQuery('');
        setActiveIndex(-1);
      }
    }, [open]);

    // Toggle the wrapper between `overflow-hidden` (during animation, so the
    // grid-row collapse looks smooth) and `overflow-visible` (when fully
    // open, so the results dropdown can spill below the panel without being
    // clipped). The animation duration matches the CSS transition below.
    useEffect(() => {
      setIsAnimating(true);
      const handle = window.setTimeout(() => {
        setIsAnimating(false);
      }, 320);
      return () => window.clearTimeout(handle);
    }, [open]);

    // Reset active-row when results change.
    useEffect(() => {
      setActiveIndex(-1);
    }, [products]);

    // Esc closes the panel (handled at panel level so it works whether or not
    // the input is focused).
    useEffect(() => {
      if (!open) return;
      const handleKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      };
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    // Outside-click closes the panel. Clicks on the header toggle button
    // (marked with `data-search-trigger`) are ignored so the toggle keeps
    // working without immediately re-closing the panel it just opened.
    useEffect(() => {
      if (!open) return;
      const handlePointer = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node | null;
        if (
          target &&
          target instanceof Element &&
          target.closest('[data-search-trigger]')
        ) {
          return;
        }
        if (
          containerRef.current &&
          target &&
          !containerRef.current.contains(target)
        ) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handlePointer);
      document.addEventListener('touchstart', handlePointer);
      return () => {
        document.removeEventListener('mousedown', handlePointer);
        document.removeEventListener('touchstart', handlePointer);
      };
    }, [open, onClose]);

    const trimmedQuery = query.trim();
    const showDropdown = open && trimmedQuery.length > 0;
    const hasResults = products.length > 0;
    const showViewAll = total > products.length;

    const goToFullResults = useCallback(() => {
      if (!trimmedQuery) return;
      trackProductSearch({
        query: trimmedQuery,
        results: total,
        surface: 'header_search',
      });
      onClose();
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }, [trimmedQuery, total, onClose, router]);

    const handleSelectProduct = useCallback(
      (product: Product) => {
        trackProductSearch({
          query: trimmedQuery,
          results: total,
          surface: 'header_search_result',
          productId: product.id,
        });
        onClose();
      },
      [onClose, trimmedQuery, total],
    );

    const handleInputKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (!hasResults && event.key !== 'Enter') return;

        switch (event.key) {
          case 'ArrowDown': {
            event.preventDefault();
            setActiveIndex((prev) => {
              const next = prev + 1;
              return next >= products.length ? 0 : next;
            });
            break;
          }
          case 'ArrowUp': {
            event.preventDefault();
            setActiveIndex((prev) => {
              const next = prev - 1;
              return next < 0 ? products.length - 1 : next;
            });
            break;
          }
          case 'Enter': {
            event.preventDefault();
            if (activeIndex >= 0 && products[activeIndex]) {
              const product = products[activeIndex];
              handleSelectProduct(product);
              router.push(`/product/${product.slug}`);
            } else if (trimmedQuery.length > 0) {
              goToFullResults();
            }
            break;
          }
          default:
            break;
        }
      },
      [
        hasResults,
        products,
        activeIndex,
        handleSelectProduct,
        router,
        goToFullResults,
        trimmedQuery,
      ],
    );

    const resultsListId = 'global-search-results';
    const activeOptionId = useMemo(
      () => (activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined),
      [activeIndex],
    );

    return (
      <div
        ref={containerRef}
        className={`relative z-30 bg-white border-b border-gray-200 grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        } ${!open || isAnimating ? 'overflow-hidden' : 'overflow-visible'}`}
        aria-hidden={!open}
      >
        <div className="min-h-0">
          <div
            className={`shadow-sm transition-transform duration-300 ease-out ${
              open ? 'translate-y-0' : '-translate-y-2'
            }`}
          >
            <div className="container-custom px-4 py-4">
              <form
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (trimmedQuery.length > 0) goToFullResults();
                }}
                className="relative"
              >
                <label htmlFor="global-search-input" className="sr-only">
                  Buscar productos
                </label>
                <div className="relative">
                  {/* Search icon inside the input */}
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                      />
                    </svg>
                  </span>

                  <input
                    ref={inputRef}
                    id="global-search-input"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Busca booster boxes, sobres, ETBs, bundles…"
                    autoComplete="off"
                    spellCheck={false}
                    role="combobox"
                    aria-expanded={showDropdown && hasResults}
                    aria-controls={resultsListId}
                    aria-activedescendant={activeOptionId}
                    aria-autocomplete="list"
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-base text-gray-900 placeholder:text-gray-400 transition-colors"
                  />

                  {/* Close button on the right */}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Live-results dropdown */}
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden z-50">
                    {status === 'loading' && !hasResults && (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        Buscando…
                      </div>
                    )}

                    {status !== 'loading' && !hasResults && (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        No hemos encontrado productos para{' '}
                        <span className="font-semibold text-gray-700">
                          “{trimmedQuery}”
                        </span>
                        .
                      </div>
                    )}

                    {hasResults && (
                      <ul
                        id={resultsListId}
                        role="listbox"
                        aria-label="Resultados de búsqueda"
                        className="divide-y divide-gray-100"
                      >
                        {products.map((product, index) => (
                          <SearchResultRow
                            key={product.id}
                            product={product}
                            isActive={index === activeIndex}
                            onMouseEnter={() => setActiveIndex(index)}
                            onSelect={() => handleSelectProduct(product)}
                          />
                        ))}
                      </ul>
                    )}

                    {hasResults && showViewAll && (
                      <button
                        type="button"
                        onClick={goToFullResults}
                        className="w-full px-4 py-3 text-center text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                      >
                        Ver todos los resultados ({total})
                      </button>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
