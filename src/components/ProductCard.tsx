import Link from 'next/link';
import { Product } from '@/types';

function getLanguageFlag(language: string): { path: string; name: string } {
  const flags: Record<string, { path: string; name: string }> = {
    ENGLISH: { path: '/images/united-kingdom.png', name: 'English' },
    JAPANESE: { path: '/images/japan.png', name: 'Japanese' },
    KOREAN: { path: '/images/south-korea.png', name: 'Korean' },
    SPANISH: { path: '/images/spain.png', name: 'Spanish' },
  };
  return flags[language] || flags.ENGLISH;
}

export function ProductCard({ product }: { product: Product }) {
  const flagInfo = getLanguageFlag(product.language);
  return (
    <Link href={`/product/${product.slug}`}>
      <div className="card card-hover cursor-pointer group">
        {product.imageUrl && (
          <div className="mb-4 h-64 bg-gray-100 rounded-lg overflow-hidden relative">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute top-3 right-3 bg-white rounded-lg p-1.5 shadow-md">
              <img
                src={flagInfo.path}
                alt={flagInfo.name}
                title={flagInfo.name}
                className="w-6 h-4 object-cover rounded"
              />
            </div>
          </div>
        )}
        
        <h3 className="text-lg font-semibold mb-2 group-hover:text-red-600">
          {product.name}
        </h3>
        
        <div className="mb-3">
          {product.discountPercentage ? (
            <div className="flex items-center gap-2">
              <p className="text-red-600 font-bold text-lg">
                €{(product.price * (1 - product.discountPercentage / 100)).toFixed(2)}
              </p>
              <p className="text-sm text-gray-400 line-through">
                €{Number(product.price).toFixed(2)}
              </p>
            </div>
          ) : (
            <p className="text-red-600 font-bold text-lg">
              €{Number(product.price).toFixed(2)}
            </p>
          )}
        </div>
        
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {product.description}
        </p>
        
        <div className="flex justify-between items-center">
          {product.available ? (
            <span className="text-green-600 text-sm font-semibold">Available</span>
          ) : (
            <span className="text-red-600 text-sm font-semibold">Sold Out</span>
          )}
        </div>
      </div>
    </Link>
  );
}