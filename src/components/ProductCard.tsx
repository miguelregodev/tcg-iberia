import Link from 'next/link';
import { Product } from '@/types';
import { formatReleaseDate, getProductInventoryState, getProductStatusLabel } from '@/lib/products/state';

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
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const releaseDate = formatReleaseDate(product.releaseDate);
  return (
    <Link href={`/product/${product.slug}`} className="h-full">
      <div className="card card-hover cursor-pointer group h-full flex flex-col">
        {product.imageUrl && (
          <div className="mb-4 h-64 bg-gray-100 rounded-lg overflow-hidden relative flex-shrink-0">
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
        
        <h3 className="text-lg font-semibold mb-2 group-hover:text-red-600 line-clamp-2 min-h-[3.5rem]">
          {product.name}
        </h3>
        
        <div className="mb-3">
          {product.discountPercentage ? (
            <div className="flex items-center gap-2">
              <p className="text-black font-bold text-lg">
                {(product.price * (1 - product.discountPercentage / 100)).toFixed(2)}€
              </p>
              <p className="text-sm text-gray-400 line-through">
                {Number(product.price).toFixed(2)}€
              </p>
            </div>
          ) : (
            <p className="text-black font-bold text-lg">
              {Number(product.price).toFixed(2)}€
            </p>
          )}
        </div>
        
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {product.description}
        </p>

        <div className="mt-auto flex flex-col gap-2">
          {inventoryState.isPreorder && releaseDate ? (
            <p className="text-xs font-semibold text-gray-600">
              Lanzamiento: {releaseDate}
            </p>
          ) : null}
          
          <div className="flex justify-between items-center">
            <span className={`text-sm font-semibold ${
              inventoryState.status === 'preorder'
                ? 'text-blue-700'
                : inventoryState.status === 'available'
                ? 'text-green-600'
                : inventoryState.status === 'low_stock'
                ? 'text-orange-600'
                : 'text-red-600'
            }`}>
              {getProductStatusLabel(inventoryState)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}