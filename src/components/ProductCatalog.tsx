'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { trackProductSearch } from '@/lib/analytics/events';
import { CatalogPriceControls } from '@/components/CatalogPriceControls';
import { useCatalogPriceFilter } from '@/hooks/useCatalogPriceFilter';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';

type LanguageFilter = 'ALL' | 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | 'CHINESE';

const LANGUAGES: { value: LanguageFilter; label: string; flag: string }[] = [
  { value: 'ALL', label: 'All Languages', flag: '' },
  { value: 'ENGLISH', label: 'English', flag: '/images/united-kingdom.png' },
  { value: 'JAPANESE', label: 'Japanese', flag: '/images/japan.png' },
  { value: 'KOREAN', label: 'Korean', flag: '/images/south-korea.png' },
  { value: 'SPANISH', label: 'Spanish', flag: '/images/spain.png' },
  { value: 'CHINESE', label: 'Chinese', flag: '/images/china.png' },
];

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { isB2B } = useB2BSession();
  const overrides = useB2BPrices(isB2B ? products.map((product) => product.id) : []);
  const b2bLoading = isB2B && overrides.size === 0 && products.length > 0;
  const { visibleProducts, priceOptions, setPriceOptions, priceBounds } =
    useCatalogPriceFilter(products, isB2B ? overrides : undefined);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
          trackProductSearch({
            query: 'catalog',
            category: 'all',
            results: data.length,
          });
        }
      } catch (error) {
        console.error('Failed to fetch products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return (
    <section id="catalog" className="section">
      <div className="container-custom">
        <CatalogPriceControls options={priceOptions} onChange={setPriceOptions} priceBounds={priceBounds} resultCount={visibleProducts.length} loading={loading || b2bLoading} />
        {loading || b2bLoading ? (
          <div className="grid md:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="bg-dark-surfaceHover rounded h-64 mb-4" />
                <div className="bg-dark-surfaceHover rounded h-6 mb-2" />
                <div className="bg-dark-surfaceHover rounded h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="text-center text-text-secondary">No hay productos que coincidan con los filtros.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {visibleProducts.map(product => {
              return <ProductCard key={product.id} product={product} />
            })}
          </div>
        )}
      </div>

      <br/>
      <div className="container-custom">
        <h2 className="text-h2 mb-8 text-center">Destacados</h2>

        {loading || b2bLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="bg-dark-surfaceHover rounded h-64 mb-4" />
                <div className="bg-dark-surfaceHover rounded h-6 mb-2" />
                <div className="bg-dark-surfaceHover rounded h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="text-center text-text-secondary">No hay productos que coincidan con los filtros.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
            {visibleProducts.map(product => {
              return <ProductCard key={product.id} product={product} />
            })}
          </div>
        )}
      </div>

    </section>
  );
}