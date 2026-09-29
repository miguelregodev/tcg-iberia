'use client';

/**
 * B2BCatalogPage
 *
 * Dedicated catalog for authenticated B2B (wholesale) users.
 *
 * - Fetches ALL products (no type restriction).
 * - Keeps only those that have at least one B2B tariff set.
 * - Renders each with its B2B price via ProductPriceDisplay.
 * - Language filter, defaulting to Japanese.
 * - Clicking a card navigates to the standard product detail page,
 *   which already shows B2B prices when the user is logged in as B2B.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';
import { trackCategoryViewed } from '@/lib/analytics/events';
import { ProductCardB2B } from './ProductCardB2B';

type Language = 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';

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

interface Props {
  language?: Language;
}

export function B2BCatalogPage({ language }: Props) {
  const router = useRouter();
  const { isB2B, customer, loading: sessionLoading } = useB2BSession();

  // Redirect non-B2B users away
  const redirected = useRef(false);
  useEffect(() => {
    if (sessionLoading) return;
    if (!isB2B && !redirected.current) {
      redirected.current = true;
      router.replace('/');
    }
  }, [isB2B, sessionLoading, router]);

  // Default language to Japanese when none supplied
  const activeLanguage: Language = language ?? 'JAPANESE';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all products (no type filter)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/products')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json() as Promise<Product[]>;
      })
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se han podido cargar los productos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      trackCategoryViewed({
        category: 'b2b-catalog',
        collection: 'Catálogo B2B',
        language: activeLanguage,
      });
    }
  }, [loading, activeLanguage]);

  // ── B2B price filter + language filter ───────────────────────────────
  const b2bOverrides = useB2BPrices(isB2B ? products.map((p) => p.id) : []);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      // Must have at least one B2B tariff
      const o = b2bOverrides.get(p.id);
      const hasTariff = !!(o?.b2bPrice && o.b2bPrice > 0);
      if (!hasTariff) return false;

      // Language filter
      return p.language === activeLanguage;
    });
  }, [products, b2bOverrides, activeLanguage]);

  // Don't show "empty" while B2B overrides are still loading
  const b2bLoading = isB2B && b2bOverrides.size === 0 && products.length > 0;

  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    total: visibleProducts.length,
  });

  // Build language-pill href, preserving the path
  const buildLangHref = (lang: Language | null) => {
    if (lang) return `/b2b-catalog?language=${lang}`;
    return '/b2b-catalog';
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isB2B) return null;

  return (
    <>
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
              <span className="inline-block bg-premium-gold/15 border border-premium-gold/30 text-premium-gold rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
                Portal Mayorista
              </span>
              <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl tracking-wider leading-tight">
                catalogo b2b
              </h1>
              <p className="mt-2 text-text-secondary text-base md:text-lg max-w-2xl">
                Bienvenido{customer?.contactName ? `, ${customer.contactName}` : ''}. Aquí
                encontrarás todos los productos con tarifas mayoristas activas.
              </p>
            </div>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center gap-2 bg-premium-gold/15 backdrop-blur-sm border border-premium-gold/30 text-premium-gold rounded-xl px-4 py-2 text-sm font-semibold">
                🏢 {customer?.companyName ?? 'Cliente B2B'}
              </span>
            </div>
          </div>

          {/* Language pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {LANGUAGES.map((lang) => {
              const active = lang === activeLanguage;
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
        </div>
      </section>

      {/* Product grid */}
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
              <div className="text-5xl mb-4">📦</div>
              <p className="text-xl font-semibold text-text-primary mb-2">
                No hay productos disponibles
              </p>
              <p className="text-text-secondary mb-6">
                No hay productos con tarifas mayoristas en{' '}
                {LANGUAGE_LABELS[activeLanguage]} todavía. Contacta con{' '}
                <a
                  href="mailto:sales@tcgiberia.com"
                  className="text-premium-gold font-medium hover:underline"
                >
                  sales@tcgiberia.com
                </a>{' '}
                para más información.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {LANGUAGES.filter((l) => l !== activeLanguage).map((l) => (
                  <Link key={l} href={buildLangHref(l)} className="btn btn-secondary">
                    Ver en {LANGUAGE_LABELS[l]}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-6">
                {visibleProducts.length} producto
                {visibleProducts.length !== 1 ? 's' : ''} con tarifa mayorista en{' '}
                {LANGUAGE_LABELS[activeLanguage]}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {visibleProducts.slice(0, visibleCount).map((product, index) => {
                  const o = b2bOverrides.get(product.id);
                  const delay = Math.min((index % 12) * 60, 600);
                  return (
                    <div
                      key={product.id}
                      className="product-reveal"
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      <ProductCardB2B
                        product={product}
                        b2bPrice={o?.b2bPrice ?? Number(product.price)}
                      />
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <div
                  ref={sentinelRef}
                  aria-hidden="true"
                  className="flex justify-center pt-8 pb-2"
                />
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
