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
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageFilter>('ALL');

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

  const filteredProducts = selectedLanguage === 'ALL'
    ? products
    : products.filter(product => product.language === selectedLanguage);

  return (
    <section id="catalog" className="section">
      <div className="container-custom">
        <h2 className="text-h2 mb-8 text-center">Catalog</h2>
        
        {/* Language Filter */}
        <div className="mb-8 flex flex-wrap gap-2 justify-center">
          {LANGUAGES.map(lang => (
            <button
              key={lang.value}
              onClick={() => setSelectedLanguage(lang.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedLanguage === lang.value
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {lang.flag && (
                <img
                  src={lang.flag}
                  alt={lang.label}
                  className="w-5 h-3 rounded"
                />
              )}
              {lang.label}
            </button>
          ))}
        </div>

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
        ) : filteredProducts.length === 0 ? (
          <p className="text-center text-gray-600">No products available</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              console.log(product)
              return <ProductCard key={product.id} product={product} />
            })}
          </div>
        )}
      </div>
    </section>
  );
}