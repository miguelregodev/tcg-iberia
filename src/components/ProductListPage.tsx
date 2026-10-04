'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Product } from '@/types';
import { ProductGridInfinite } from './ProductGridInfinite';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { trackCategoryViewed, trackCollectionViewed, trackProductSearch } from '@/lib/analytics/events';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';
import { Breadcrumbs } from './Breadcrumbs';

type Language = 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';

interface ProductListPageProps {
  title: string;
  /**
   * Substring that must appear in the product's `type` (case-insensitive).
   * Examples: 'booster box', 'pack' (matches 'Booster Pack'),
   * 'bundle' (matches 'Booster Bundle').
   */
  productType: string;
  language?: Language;
  subtitle?: string;
  eyebrow?: string;
  /** Restrict which language filter pills are shown. Defaults to all four. */
  allowedLanguages?: Language[];
  /** Show language filter pills. Defaults to true. */
  showLanguageFilters?: boolean;
  /** Show the language flag badge on each product card. Defaults to true. */
  showLanguageFlag?: boolean;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  ENGLISH: 'Inglés',
  JAPANESE: 'Japonés',
  KOREAN: 'Coreano',
  SPANISH: 'Español',
};

const LANGUAGE_FLAGS: Record<Language, string> = {
  ENGLISH: '/images/united-kingdom.png',
  JAPANESE: '/images/japan.png',
  KOREAN: '/images/south-korea.png',
  SPANISH: '/images/spain.png',
};

const LANGUAGES: Language[] = ['ENGLISH', 'JAPANESE', 'KOREAN', 'SPANISH'];

export function ProductListPage({
  title,
  productType,
  language,
  subtitle,
  eyebrow,
  allowedLanguages,
  showLanguageFilters = true,
  showLanguageFlag = true,
}: ProductListPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/products');
        if (response.ok) {
          const data: Product[] = await response.json();

          const wantedType = productType.toLowerCase();
          const filtered = data.filter((p) => {
            const typeMatch = p.type
              ? p.type.toLowerCase().includes(wantedType)
              : false;
            const langMatch = !language || p.language === language;
            return typeMatch && langMatch;
          });

          if (!cancelled) setProducts(filtered);
        } else if (!cancelled) {
          setError('No se han podido cargar los productos.');
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        if (!cancelled) setError('No se han podido cargar los productos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [productType, language]);

  useEffect(() => {
    trackCategoryViewed({
      category: productType,
      collection: title,
      language: language ?? 'ALL',
    });
  }, [productType, title, language]);

  // ── B2B catalog filter ────────────────────────────────────────────────
  //     Wholesale customers only see products that have a B2B (Sellado)
  //     price defined. The public serializer strips the b2b* fields so we
  //     fetch them via `/api/b2b/prices` — same batched endpoint used to
  //     swap in prices on ProductCard.
  const { isB2B } = useB2BSession();
  const b2bOverrides = useB2BPrices(isB2B ? products.map((p) => p.id) : []);
  const b2bFilteredProducts = useMemo(() => {
    if (!isB2B) return products;
    return products.filter((p) => {
      const o = b2bOverrides.get(p.id);
      return !!(o?.b2bPrice && o.b2bPrice > 0);
    });
  }, [isB2B, products, b2bOverrides]);
  const inStockCount = useMemo(
    () => b2bFilteredProducts.filter((p) => p.available).length,
    [b2bFilteredProducts],
  );
  const visibleProducts = useMemo(() => {
    if (!inStockOnly) return b2bFilteredProducts;
    return b2bFilteredProducts.filter((p) => p.available);
  }, [b2bFilteredProducts, inStockOnly]);

  // Wait for the overrides to arrive before showing "empty" — otherwise the
  // page would flicker "no products" for B2B users on first render.
  const b2bLoading = isB2B && b2bOverrides.size === 0 && products.length > 0;

  useEffect(() => {
    if (loading) return;

    trackCollectionViewed({
      category: productType,
      collection: title,
      language: language ?? 'ALL',
      results: visibleProducts.length,
    });

    trackProductSearch({
      query: productType,
      category: productType,
      language: language ?? 'ALL',
      results: visibleProducts.length,
    });
  }, [loading, productType, title, language, visibleProducts.length]);

  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    total: visibleProducts.length,
  });

  // Build language-pill href, preserving the current path. Derived from
  // usePathname() (not window.location) so the server-rendered HTML and the
  // client's first render produce the exact same string, avoiding a
  // hydration mismatch.
  const pathname = usePathname();
  const buildLangHref = (lang: Language | null) => {
    return lang ? `${pathname}?language=${lang}` : pathname;
  };

  return (
    <>
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: title }]} />

      {/* Hero header */}
      <section className="relative overflow-hidden bg-dark-bgSecondary text-text-primary border-b border-dark-border">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(245,231,122,0.10) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(245,231,122,0.08) 0%, transparent 60%)',
          }}
        />

        <div className="container-custom px-4 relative z-10 py-10 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <span className="inline-block bg-premium-gold/10 backdrop-blur-sm border border-premium-gold/20 text-premium-gold rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
                {eyebrow ?? 'Catálogo'}
              </span>
              <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl tracking-wider leading-tight">
                {title}
              </h1>
              <p className="mt-2 text-text-secondary text-base md:text-lg max-w-2xl">
                {subtitle ??
                  'Descubre nuestra colección, filtrada por idioma y siempre con stock real.'}
              </p>
            </div>
          </div>

          {/* Language pills — only shown if showLanguageFilters is true */}
          {showLanguageFilters && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                href={buildLangHref(null)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors ${
                  !language
                    ? 'bg-premium-gold text-dark-bg border-premium-gold shadow-sm'
                    : 'bg-dark-surfaceHover text-text-secondary border-dark-border hover:text-text-primary'
                }`}
              >
                Todos los idiomas
              </Link>
              {(allowedLanguages ?? LANGUAGES).map((lang) => {
                const active = language === lang;
                return (
                  <Link
                    key={lang}
                    href={buildLangHref(lang)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors ${
                      active
                        ? 'bg-premium-gold text-dark-bg border-premium-gold shadow-sm'
                        : 'bg-dark-surfaceHover text-text-secondary border-dark-border hover:text-text-primary'
                    }`}
                  >
                    <img
                      src={LANGUAGE_FLAGS[lang]}
                      alt=""
                      className="w-4 h-3 object-cover rounded-sm"
                    />
                    {LANGUAGE_LABELS[lang]}
                  </Link>
                );
              })}
            </div>
          )}

          {/* In-stock-only filter — always available, independent of language pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInStockOnly((v) => !v)}
              aria-pressed={inStockOnly}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors ${
                inStockOnly
                  ? 'bg-premium-gold text-dark-bg border-premium-gold shadow-sm'
                  : 'bg-dark-surfaceHover text-text-secondary border-dark-border hover:text-text-primary'
              }`}
            >
              {inStockOnly && <span aria-hidden="true">✓</span>}
              Disponible ({inStockCount})
            </button>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="bg-dark-bg">
        <div className="container-custom px-4 py-10 md:py-14">
          {error && (
            <div className="bg-danger-bg border border-danger/30 rounded-lg p-4 mb-8 text-danger text-sm">
              {error}
            </div>
          )}

          {loading || b2bLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-dark-surface rounded-2xl border border-dark-border p-4 animate-pulse"
                >
                  <div className="bg-dark-surfaceHover rounded-xl h-56 mb-4" />
                  <div className="bg-dark-surfaceHover rounded h-5 mb-2 w-3/4" />
                  <div className="bg-dark-surfaceHover rounded h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-12 text-center shadow-sm">
              <p className="text-4xl sm:text-6xl md:text-8xl font-airstrike text-premium-gold mb-6 tracking-wider">
                Próximamente
              </p>
              <p className="text-text-secondary mb-8 text-lg">
                Estamos reponiendo stock, vuelve a visitarnos pronto.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {language && (
                  <Link
                    href={buildLangHref(null)}
                    className="btn btn-secondary"
                  >
                    Ver todos los idiomas
                  </Link>
                )}
                <Link href="/" className="btn btn-primary">
                  Volver al inicio
                </Link>
              </div>
            </div>
          ) : (
            <ProductGridInfinite
              products={visibleProducts}
              visibleCount={visibleCount}
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              showLanguageFlag={showLanguageFlag}
            />
          )}
        </div>
      </section>
    </>
  );
}
