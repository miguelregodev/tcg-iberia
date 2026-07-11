'use client';

import Link from 'next/link';
import { Product } from '@/types';
import { formatReleaseDate, getProductInventoryState } from '@/lib/products/state';

interface Props {
  product: Product;
  /** B2B wholesale price for the shrink (with-plastic) variant */
  b2bPrice: number;
  /** B2B wholesale price for the no-shrink variant — null when not available */
  b2bPriceNoShrink: number | null;
}

function getLanguageFlag(language: string): { path: string; name: string } {
  const flags: Record<string, { path: string; name: string }> = {
    ENGLISH: { path: '/images/united-kingdom.png', name: 'English' },
    JAPANESE: { path: '/images/japan.png', name: 'Japanese' },
    KOREAN: { path: '/images/south-korea.png', name: 'Korean' },
    SPANISH: { path: '/images/spain.png', name: 'Spanish' },
  };
  return flags[language] || flags.ENGLISH;
}

export function ProductCardB2B({ product, b2bPrice, b2bPriceNoShrink }: Props) {
  const flagInfo = getLanguageFlag(product.language);
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const releaseDate = formatReleaseDate(product.releaseDate);

  return (
    <Link href={`/b2b/product/${product.slug}`} className="h-full">
      <div className="card card-hover cursor-pointer group h-full flex flex-col">
        {product.imageUrl && (
          <div className="mb-4 h-64 bg-gray-100 rounded-lg overflow-hidden relative flex-shrink-0">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            {/* Language flag */}
            <div className="absolute top-3 right-3 bg-white rounded-lg p-1.5 shadow-md">
              <img
                src={flagInfo.path}
                alt={flagInfo.name}
                title={flagInfo.name}
                className="w-6 h-4 object-cover rounded"
              />
            </div>
            {/* B2B badge */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-red-600 text-white shadow-sm">
                B2B
              </span>
            </div>
          </div>
        )}

        <h3 className="text-lg font-semibold mb-2 group-hover:text-red-600 line-clamp-2 min-h-[3.5rem]">
          {product.name}
        </h3>

        {/* B2B price(s) */}
        <div className="mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-black font-bold text-sm">{b2bPrice.toFixed(2)}€</p>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Con plástico
            </span>
          </div>
          {b2bPriceNoShrink != null && (
            <div className="flex items-center gap-2">
              <p className="text-gray-700 font-semibold text-sm">
                {b2bPriceNoShrink.toFixed(2)}€
              </p>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Sin plástico
              </span>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>

        <div className="mt-auto flex flex-col gap-2">
          {inventoryState.isPreorder && releaseDate ? (
            <p className="text-xs font-semibold text-gray-600">Lanzamiento: {releaseDate}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
