'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';

interface ProductListPageProps {
  title: string;
  productType: 'booster box' | 'pack' | 'bundle';
  language?: 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';
}

export function ProductListPage({ title, productType, language }: ProductListPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const response = await fetch('/api/products');
        if (response.ok) {
          const data: Product[] = await response.json();
          
          // Filter by product type and language
          const filtered = data.filter(p => {
            const typeMatch = p.type?.toLowerCase() === productType.toLowerCase();
            const langMatch = !language || p.language === language;
            return typeMatch && langMatch;
          });
          
          setProducts(filtered);
          setError(null);
        } else {
          setError('Failed to fetch products');
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to fetch products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [productType, language]);

  return (
    <section className="section">
      <div className="container-custom">
        <h1 className="text-h2 mb-2 text-center">{title}</h1>
        {language && (
          <p className="text-center text-gray-600 mb-8">
            Language: <span className="font-semibold">{language}</span>
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="bg-gray-200 rounded h-64 mb-4" />
                <div className="bg-gray-200 rounded h-6 mb-2" />
                <div className="bg-gray-200 rounded h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600 text-lg mb-4">
              No products found for this selection.
            </p>
            <a href="/" className="btn btn-primary inline-block">
              Back to Home
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
