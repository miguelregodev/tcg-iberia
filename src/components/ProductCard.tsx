import Link from 'next/link';
import { Product } from '@/types';
import { formatReleaseDate, getProductInventoryState } from '@/lib/products/state';
import { ProductPriceDisplay } from './ProductPriceDisplay';
import { InventoryStatusLabel } from './InventoryStatusLabel';
import { getProductDisplayName } from '@/lib/seo/product';
import { LANGUAGE_SEO } from '@/lib/seo/languages';

function getLanguageFlag(language: string): { path: string; name: string } {
  const flags: Record<string, { path: string; name: string }> = {
    ENGLISH: { path: '/images/united-kingdom.png', name: LANGUAGE_SEO.ENGLISH.label },
    JAPANESE: { path: '/images/japan.png', name: LANGUAGE_SEO.JAPANESE.label },
    KOREAN: { path: '/images/south-korea.png', name: LANGUAGE_SEO.KOREAN.label },
    SPANISH: { path: '/images/spain.png', name: LANGUAGE_SEO.SPANISH.label },
  };
  return flags[language] || flags.ENGLISH;
}

interface ProductCardProps {
  product: Product;
  /** Show the language flag badge on the product image. Defaults to true. */
  showLanguageFlag?: boolean;
  /** Above-the-fold card: load the image eagerly with high priority. */
  priority?: boolean;
}

export function ProductCard({ product, showLanguageFlag = true, priority = false }: ProductCardProps) {
  const flagInfo = getLanguageFlag(product.language);
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const releaseDate = formatReleaseDate(product.releaseDate);
  return (
    <Link href={`/product/${product.slug}`} className="h-full">
      <div className="cursor-pointer group h-full flex flex-col transition-all duration-300">
        {product.imageUrl && (
          <div className="mb-4 h-64 rounded-lg overflow-hidden relative flex-shrink-0">
            <img
              src={product.imageUrl}
              alt={showLanguageFlag ? getProductDisplayName(product) : product.name}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            {showLanguageFlag && (
              <div className="absolute top-3 right-3 bg-dark-surface/90 backdrop-blur rounded-lg p-1.5 shadow-elevated border border-dark-border">
                <img
                  src={flagInfo.path}
                  alt={`Idioma: ${flagInfo.name}`}
                  title={flagInfo.name}
                  width={24}
                  height={16}
                  loading="lazy"
                  className="w-6 h-4 object-cover rounded"
                />
              </div>
            )}
          </div>
        )}
        
        <h3 className="text-lg font-semibold mb-2 text-text-primary group-hover:text-premium-gold transition-colors line-clamp-2 min-h-[3.5rem]">
          {product.name}
        </h3>
        
        <div className="mb-3">
          <ProductPriceDisplay
            productId={product.id}
            publicPrice={Number(product.price)}
            discountPercentage={product.discountPercentage}
            liveOpeningPrice={product.liveOpeningPrice}
          />
        </div>
        
        <p className="text-sm text-text-secondary mb-4 line-clamp-2">
          {product.description}
        </p>

        <div className="mt-auto flex flex-col gap-2">
          {inventoryState.isPreorder && releaseDate ? (
            <p className="text-xs font-semibold text-text-secondary">
              Lanzamiento: {releaseDate}
            </p>
          ) : null}
          
          <div className="flex justify-between items-center">
            <InventoryStatusLabel inventoryState={inventoryState} />
          </div>
        </div>
      </div>
    </Link>
  );
}