import Link from 'next/link';
import { Product } from '@/types';
import { formatReleaseDate, getProductInventoryState } from '@/lib/products/state';
import { getCategoryForProductType } from '@/lib/products/categories';
import { ProductPriceDisplay } from './ProductPriceDisplay';
import { InventoryStatusLabel } from './InventoryStatusLabel';
import { AddToCartButton } from './AddToCartButton';

function getLanguageFlag(language: string): { path: string; name: string } {
  const flags: Record<string, { path: string; name: string }> = {
    ENGLISH: { path: '/images/united-kingdom.png', name: 'English' },
    JAPANESE: { path: '/images/japan.png', name: 'Japanese' },
    KOREAN: { path: '/images/south-korea.png', name: 'Korean' },
    SPANISH: { path: '/images/spain.png', name: 'Spanish' },
    CHINESE: { path: '/images/china.png', name: 'Chinese' },
  };
  return flags[language] || flags.ENGLISH;
}

interface ProductCardProps {
  product: Product;
  /** Show the language flag badge on the product image. Defaults to true. */
  showLanguageFlag?: boolean;
  showAddToCart?: boolean;
}

export function ProductCard({ product, showLanguageFlag = true, showAddToCart = false }: ProductCardProps) {
  const flagInfo = getLanguageFlag(product.language);
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const releaseDate = formatReleaseDate(product.releaseDate);
  // Graded/raw single cards and mystery packs use a 5:7 portrait frame instead of the default.
  const categoryHref = getCategoryForProductType(product.type)?.href;
  const isPortraitImage =
    categoryHref === '/psa' || categoryHref === '/raw' || categoryHref === '/mystery-packs';
  return (
    <div className="h-full">
      <div className="relative cursor-pointer group h-full flex flex-col transition-all duration-300">
        {product.imageUrl && (
          <div
            className={`mb-4 rounded-lg overflow-hidden relative flex-shrink-0 ${
              isPortraitImage ? 'aspect-[5/7]' : 'h-64'
            }`}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            {showLanguageFlag && (
              <div className="absolute top-3 right-3 bg-dark-surface/90 backdrop-blur rounded-lg p-1.5 shadow-elevated border border-dark-border">
                <img
                  src={flagInfo.path}
                  alt={flagInfo.name}
                  title={flagInfo.name}
                  className="w-6 h-4 object-cover rounded"
                />
              </div>
            )}
            {showAddToCart && (
              <div className="absolute bottom-3 right-3 z-20 hidden md:block">
                <AddToCartButton product={product} />
              </div>
            )}
          </div>
        )}
        
        <h3 className="text-lg font-semibold mb-2 text-text-primary group-hover:text-premium-gold transition-colors line-clamp-2 min-h-[3.5rem]">
          {/* Stretched link: the whole card is clickable without nesting the cart button in an anchor. */}
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>
        
        <p className="text-sm text-text-secondary mb-3 line-clamp-2 min-h-[2.5rem]">
          {product.description}
        </p>

        <div className="mt-auto flex items-center gap-2">
          {showAddToCart && (
            <div className={`flex-shrink-0 ${product.imageUrl ? 'md:hidden' : ''}`}>
              <AddToCartButton product={product} />
            </div>
          )}
          <div className="min-w-0 flex-1 flex flex-col-reverse items-end gap-1 md:flex-row md:items-center md:justify-between md:gap-2">
            <InventoryStatusLabel inventoryState={inventoryState} />
            <ProductPriceDisplay
              productId={product.id}
              publicPrice={Number(product.price)}
              discountPercentage={product.discountPercentage}
              liveOpeningPrice={product.liveOpeningPrice}
              className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1"
              priceClassName="text-premium-gold font-bold text-lg md:text-2xl"
            />
          </div>
        </div>
        {inventoryState.isPreorder && releaseDate && (
          <p className="mt-2 text-xs font-semibold text-text-secondary">
            Lanzamiento: {releaseDate}
          </p>
        )}
      </div>
    </div>
  );
}