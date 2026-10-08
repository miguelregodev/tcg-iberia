'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import type { Product } from '@/types';
import { ProductGridInfinite } from './ProductGridInfinite';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { trackProductSearch } from '@/lib/analytics/events';
import { SEARCH_MAX_LIMIT, type SearchResponse, tokenize } from '@/lib/products/search';

interface SearchResultsPageProps {
  /** Raw `q` from the URL search params. */
  query: string;
}

export function SearchResultsPage({ query }: SearchResultsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const tokens = useMemo(() => tokenize(trimmedQuery), [trimmedQuery]);

  useEffect(() => {
    if (tokens.length === 0) {
      setProducts([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          q: trimmedQuery,
          limit: String(SEARCH_MAX_LIMIT),
        });
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as SearchResponse;
        if (cancelled) return;
        setProducts(data.products);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (cancelled) return;
        console.error('SearchResultsPage fetch error', err);
        setError('No se han podido cargar los resultados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trimmedQuery, tokens.length]);

  // Analytics: report once per resolved query/results pair.
  useEffect(() => {
    if (loading || tokens.length === 0) return;
    trackProductSearch({
      query: trimmedQuery,
      results: total,
      surface: 'search_page',
    });
  }, [loading, trimmedQuery, total, tokens.length]);

  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    total: products.length,
  });

  return (
    <>
      {/* Hero — mirrors ProductListPage so the visual language stays consistent */}
      <section className="relative overflow-hidden bg-dark-bgSecondary text-text-primary border-b border-dark-border">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(245,231,122,0.10) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(245,231,122,0.08) 0%, transparent 60%)',
          }}
        />
        <div className="container-custom px-4 relative z-10 py-10 md:py-16">
          <span className="inline-block bg-premium-gold/10 backdrop-blur-sm border border-premium-gold/20 text-premium-gold rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
            Resultados de búsqueda
          </span>
          <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl tracking-wider leading-tight">
            {trimmedQuery
              ? <>productos</>
              : 'buscar productos'}
          </h1>
          {!loading && trimmedQuery && (
            <p className="mt-2 text-text-secondary text-base md:text-lg">
              {total === 0
                ? 'No hemos encontrado productos que coincidan con tu búsqueda.'
                : `${total} ${total === 1 ? 'producto encontrado' : 'productos encontrados'}.`}
            </p>
          )}
        </div>
      </section>

      <section className="bg-dark-bg">
        <div className="container-custom px-4 py-10 md:py-14">
          {error && (
            <div className="bg-danger-bg border border-danger/30 rounded-lg p-4 mb-8 text-danger text-sm">
              {error}
            </div>
          )}

          {!trimmedQuery ? (
            <EmptyState
              title="Empieza tu búsqueda"
              message="Escribe el nombre de un producto, una colección o un tipo (booster box, ETB, bundle…)."
            />
          ) : loading ? (
            <SkeletonGrid />
          ) : products.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              message={`No hemos encontrado productos para “${trimmedQuery}”. Prueba con otros términos o revisa la ortografía.`}
            />
          ) : (
            <ProductGridInfinite
              products={products}
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

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
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
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-dark-surface rounded-2xl border border-dark-border p-12 text-center shadow-sm">
      <div className="text-5xl mb-4">🔍</div>
      <p className="text-xl font-semibold text-text-primary mb-2">{title}</p>
      <p className="text-text-secondary mb-6">{message}</p>
      <Link href="/" className="btn btn-primary">
        Volver al inicio
      </Link>
    </div>
  );
}
