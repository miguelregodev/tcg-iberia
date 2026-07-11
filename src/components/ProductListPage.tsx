'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { ProductGridInfinite } from './ProductGridInfinite';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { trackCategoryViewed, trackCollectionViewed, trackProductSearch } from '@/lib/analytics/events';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';

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
}: ProductListPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  //     Wholesale customers only see products that have at least one B2B
  //     price defined (SHRINK or NO_SHRINK). The public serializer strips
  //     the b2b* fields so we fetch them via `/api/b2b/prices` — same batched
  //     endpoint used to swap in prices on ProductCard.
  const { isB2B } = useB2BSession();
  const b2bOverrides = useB2BPrices(isB2B ? products.map((p) => p.id) : []);
  const visibleProducts = useMemo(() => {
    if (!isB2B) return products;
    return products.filter((p) => {
      const o = b2bOverrides.get(p.id);
      const hasShrink = !!(o?.b2bPrice && o.b2bPrice > 0);
      const hasNoShrink = !!(o?.b2bPriceNoShrink && o.b2bPriceNoShrink > 0);
      return hasShrink || hasNoShrink;
    });
  }, [isB2B, products, b2bOverrides]);

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

  // Build language-pill href, preserving the current path.
  const buildLangHref = (lang: Language | null) => {
    if (typeof window === 'undefined') {
      return lang ? `?language=${lang}` : '?';
    }
    const url = new URL(window.location.href);
    if (lang) {
      url.searchParams.set('language', lang);
    } else {
      url.searchParams.delete('language');
    }
    return url.pathname + (url.search || '');
  };

  return (
    <>
      {/* Hero header — same recipe as Hit Cards top section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-red-900 to-black text-white">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(220,38,38,0.4) 0%, transparent 60%)',
          }}
        />

        <div className="container-custom px-4 relative z-10 py-10 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <span className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
                {eyebrow ?? 'Catálogo'}
              </span>
              <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl tracking-wider leading-tight">
                {title}
              </h1>
              <p className="mt-2 text-gray-300 text-base md:text-lg max-w-2xl">
                {subtitle ??
                  'Descubre nuestra colección, filtrada por idioma y siempre con stock real.'}
              </p>
            </div>
          </div>

          {/* Language pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={buildLangHref(null)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors ${
                !language
                  ? 'bg-white text-red-700 border-white shadow-sm'
                  : 'bg-white/10 backdrop-blur-sm text-white border-white/20 hover:bg-white/20'
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
                      ? 'bg-white text-red-700 border-white shadow-sm'
                      : 'bg-white/10 backdrop-blur-sm text-white border-white/20 hover:bg-white/20'
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
        </div>
      </section>

      {/* Body */}
      <section className="bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <div className="container-custom px-4 py-10 md:py-14">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading || b2bLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse"
                >
                  <div className="bg-gray-200 rounded-xl h-56 mb-4" />
                  <div className="bg-gray-200 rounded h-5 mb-2 w-3/4" />
                  <div className="bg-gray-200 rounded h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
              <div className="text-5xl mb-4">📦</div>
              <p className="text-xl font-semibold text-gray-900 mb-2">
                No hay productos disponibles
              </p>
              <p className="text-gray-500 mb-6">
                {isB2B
                  ? 'No hay productos con tarifas mayoristas para esta categoría todavía. Contacta con sales@tcgiberia.com para más información.'
                  : language
                    ? `No tenemos productos en ${LANGUAGE_LABELS[language]} para esta categoría ahora mismo.`
                    : 'No hemos encontrado productos en esta categoría ahora mismo.'}
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
            />
          )}
        </div>
      </section>
    </>
  );
}
