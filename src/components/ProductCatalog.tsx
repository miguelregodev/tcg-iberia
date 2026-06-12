'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';

type LanguageFilter = 'ALL' | 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';

const LANGUAGES: { value: LanguageFilter; label: string; flag: string }[] = [
  { value: 'ALL', label: 'All Languages', flag: '' },
  { value: 'ENGLISH', label: 'English', flag: '/images/united-kingdom.png' },
  { value: 'JAPANESE', label: 'Japanese', flag: '/images/japan.png' },
  { value: 'KOREAN', label: 'Korean', flag: '/images/south-korea.png' },
  { value: 'SPANISH', label: 'Spanish', flag: '/images/spain.png' },
];

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
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
        {loading ? (
          <div className="grid md:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="bg-gray-200 rounded h-64 mb-4" />
                <div className="bg-gray-200 rounded h-6 mb-2" />
                <div className="bg-gray-200 rounded h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-600">No products available</p>
        ) : (
          <div className="grid md:grid-cols-4 gap-6">
            {products.map(product => {
              console.log(product)
              return <ProductCard key={product.id} product={product} />
            })}
          </div>
        )}
      </div>

      <br/>
      <div className="container-custom">
        <h2 className="text-h2 mb-8 text-center">Destacados</h2>

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
          <p className="text-center text-gray-600">No products available</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {products.map(product => {
              console.log(product)
              return <ProductCard key={product.id} product={product} />
            })}
          </div>
        )}
      </div>

    </section>
  );
}