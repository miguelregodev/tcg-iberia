'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';
import { getProductInventoryState, formatReleaseDate } from '@/lib/products/state';

interface Props {
  product: Product;
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

export function B2BProductDetailClient({ product }: Props) {
  console.log("DETAIL COMPONENT");
  const router = useRouter();
  const { isB2B, loading: sessionLoading } = useB2BSession();

  // Redirect non-B2B visitors to the public product page
  const redirected = useRef(false);
  console.log({
    sessionLoading,
    isB2B,
    productId: product.id,
  });
  useEffect(() => {
    
    if (sessionLoading) return;
    if (!isB2B && !redirected.current) {
      redirected.current = true;
      router.replace(`/product/${product.slug}`);
    }
  }, [isB2B, sessionLoading, router, product.slug]);

  // Fetch B2B price overrides for this product
  const b2bOverrides = useB2BPrices([product.id]);
  const b2bPrice = b2bOverrides.get(product.id)?.b2bPrice ?? null;
  const b2bPriceNoShrink = b2bOverrides.get(product.id)?.b2bPriceNoShrink ?? null;

  // True while the /api/b2b/prices fetch is still in-flight (map starts empty)
  const b2bPricesLoading = isB2B && b2bOverrides.size === 0;

  // Show the variant selector whenever the product physically has a no-shrink option
  const hasNoShrink = b2bPriceNoShrink != null;

  const [variant, setVariant] = useState<'shrink' | 'noshrink'>('shrink');
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const { addToCart, items } = useCart();
  const flagInfo = getLanguageFlag(product.language);
  const releaseDate = formatReleaseDate(product.releaseDate);

  // Effective B2B price for the active variant.
  // Falls back to the public price only after the API has responded (not while loading).
  const effectiveShrinkPrice = b2bPrice ?? Number(product.price);
  const effectiveNoShrinkPrice = b2bPriceNoShrink ?? (product.b2bPriceNoShrink ? Number(product.b2bPriceNoShrink) : null);
  const activeB2BPrice =
    variant === 'noshrink' && effectiveNoShrinkPrice != null
      ? effectiveNoShrinkPrice
      : effectiveShrinkPrice;

  // Build the cart product object for the active variant
  const variantProduct =
    hasNoShrink && variant === 'noshrink'
      ? {
          ...product,
          id: `${product.id}_noshrink`,
          price: Number(product.b2bPriceNoShrink!),
          discountPercentage: null,
          stock: product.noShrinkStock,
        }
      : product;

  const inventoryState = getProductInventoryState({
    stock: variantProduct.stock,
    releaseDate: product.releaseDate,
  });

  const inCartQuantity =
    items.find((it) => it.product.id === variantProduct.id)?.quantity ?? 0;
  const maxAddable = Math.max(0, 99 - inCartQuantity);
  const reachedMax = quantity >= maxAddable;

  const handleAddToCart = () => {
    if (!inventoryState.canPurchase) return;
    const safeQty = Math.min(quantity, maxAddable);
    addToCart(variantProduct, safeQty);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isB2B) return null;

  console.log("Map size:", b2bOverrides.size);

  console.log("Product id:", product.id);

  console.log("Lookup:", b2bOverrides.get(product.id));
  console.log("Component render");
  console.log("Map identity", b2bOverrides);
  console.log("COMPONENT MAP", [...b2bOverrides.entries()]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-8 md:py-16">
      <div className="container-custom px-4">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/b2b-catalog"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            ← Volver al catálogo B2B
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-16">
          {/* Image */}
          <div className="flex flex-col gap-6">
            {product.imageUrl && (
              <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 h-96 lg:h-[500px] flex items-center justify-center">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain p-8"
                />
                {/* Language flag */}
                <div className="absolute top-4 left-4 bg-white rounded-lg p-2 shadow-md">
                  <img
                    src={flagInfo.path}
                    alt={flagInfo.name}
                    title={flagInfo.name}
                    className="w-8 h-5 object-cover rounded"
                  />
                </div>
                {/* B2B badge */}
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-red-600 text-white shadow-lg">
                    B2B
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="text-2xl lg:text-3xl font-bold text-black mb-2 leading-tight">
              {product.name}
            </h1>

            {inventoryState.isPreorder && releaseDate && (
              <p className="text-sm font-semibold text-blue-700 mb-4">
                Lanzamiento: {releaseDate}
              </p>
            )}

            <div className="mb-6" />

            {/* Variant selector — shown only when B2B no-shrink price exists */}
            {hasNoShrink && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Formato
                </p>
                <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setVariant('shrink')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                      variant === 'shrink'
                        ? 'bg-red-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Con Plástico —{' '}
                    <span className="font-bold">
                      {b2bPricesLoading ? (
                        <span className="inline-block w-14 h-4 bg-current opacity-20 animate-pulse rounded" />
                      ) : (
                        `${effectiveShrinkPrice.toFixed(2)}€`
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariant('noshrink')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 ${
                      variant === 'noshrink'
                        ? 'bg-red-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Sin Plástico —{' '}
                    <span className="font-bold">
                      {b2bPricesLoading ? (
                        <span className="inline-block w-14 h-4 bg-current opacity-20 animate-pulse rounded" />
                      ) : (
                        `${(effectiveNoShrinkPrice ?? Number(product.b2bPriceNoShrink!)).toFixed(2)}€`
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-8">
              {b2bPricesLoading ? (
                <div className="h-10 w-36 bg-gray-200 animate-pulse rounded-lg" />
              ) : (
                <span className="text-xl font-bold text-black">
                  {activeB2BPrice.toFixed(2)}€
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                Precio B2B
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-8">
                <p className="text-gray-700 leading-relaxed">
                  {product.description.split('\n')[0]}
                </p>
              </div>
            )}

            {/* Notes */}
            {product.notes && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-black uppercase tracking-wide mb-3">
                  Detalles
                </h3>
                <div className="space-y-2">
                  {product.notes
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean)
                    .map((note, i) => (
                      <p key={i} className="text-gray-700 text-sm">
                        {note}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Unidades
              </span>
              <div className="flex items-center border-2 border-gray-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-red-600 disabled:opacity-40 transition-colors"
                >
                  −
                </button>
                <span className="w-12 text-center font-bold text-gray-900 text-sm">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(q + 1, maxAddable))}
                  disabled={reachedMax || maxAddable === 0}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-red-600 disabled:opacity-40 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to cart */}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inventoryState.canPurchase || maxAddable === 0}
              className={`w-full py-4 px-8 rounded-xl text-base font-bold transition-all shadow-lg mb-4 ${
                addedToCart
                  ? 'bg-green-600 text-white scale-95'
                  : inventoryState.canPurchase && maxAddable > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {addedToCart
                ? '✓ Añadido al carrito'
                : inventoryState.isPreorder
                ? 'Reservar'
                : maxAddable === 0
                ? 'Sin stock'
                : 'Añadir al carrito'}
            </button>

            <p className="text-xs text-center text-gray-400">
              Las solicitudes de pedido B2B se confirman por email tras la revisión del equipo de
              ventas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
