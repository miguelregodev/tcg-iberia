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

  // True while the /api/b2b/prices fetch is still in-flight (map starts empty)
  const b2bPricesLoading = isB2B && b2bOverrides.size === 0;

  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const { addToCart, items } = useCart();
  const flagInfo = getLanguageFlag(product.language);
  const releaseDate = formatReleaseDate(product.releaseDate);

  // Effective B2B price (always the Sellado variant).
  // Falls back to the public price only after the API has responded (not while loading).
  const effectivePrice = b2bPrice ?? Number(product.price);

  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });

  const inCartQuantity =
    items.find((it) => it.product.id === product.id)?.quantity ?? 0;
  const maxAddable = Math.max(0, 99 - inCartQuantity);
  const reachedMax = quantity >= maxAddable;

  const handleAddToCart = () => {
    if (!inventoryState.canPurchase) return;
    const safeQty = Math.min(quantity, maxAddable);
    addToCart(product, safeQty);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isB2B) return null;

  return (
    <div className="min-h-screen bg-dark-bg py-8 md:py-16">
      <div className="container-custom px-4">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/b2b-catalog"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-premium-gold transition-colors"
          >
            ← Volver al catálogo B2B
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-16">
          {/* Image */}
          <div className="flex flex-col gap-6">
            {product.imageUrl && (
              <div className="relative bg-dark-surface rounded-2xl shadow-elevated overflow-hidden border border-dark-border h-96 lg:h-[500px] flex items-center justify-center">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain p-8"
                />
                {/* Language flag */}
                <div className="absolute top-4 left-4 bg-dark-surface/90 backdrop-blur rounded-lg p-2 shadow-elevated border border-dark-border">
                  <img
                    src={flagInfo.path}
                    alt={flagInfo.name}
                    title={flagInfo.name}
                    className="w-8 h-5 object-cover rounded"
                  />
                </div>
                {/* B2B badge */}
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-premium-gold text-dark-bg shadow-elevated">
                    B2B
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2 leading-tight">
              {product.name}
            </h1>

            {inventoryState.isPreorder && releaseDate && (
              <p className="text-sm font-semibold text-premium-gold mb-4">
                Lanzamiento: {releaseDate}
              </p>
            )}

            <div className="mb-6" />

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-8">
              {b2bPricesLoading ? (
                <div className="h-10 w-36 bg-dark-surfaceHover animate-pulse rounded-lg" />
              ) : (
                <span className="text-xl font-bold text-premium-gold">
                  {effectivePrice.toFixed(2)}€
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-premium-gold/15 text-premium-gold">
                Precio B2B
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-8">
                <p className="text-text-secondary leading-relaxed">
                  {product.description.split('\n')[0]}
                </p>
              </div>
            )}

            {/* Notes */}
            {product.notes && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide mb-3">
                  Detalles
                </h3>
                <div className="space-y-2">
                  {product.notes
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean)
                    .map((note, i) => (
                      <p key={i} className="text-text-secondary text-sm">
                        {note}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Unidades
              </span>
              <div className="flex items-center border-2 border-dark-border rounded-lg bg-dark-surface">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-premium-gold disabled:opacity-40 transition-colors"
                >
                  −
                </button>
                <span className="w-12 text-center font-bold text-text-primary text-sm">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(q + 1, maxAddable))}
                  disabled={reachedMax || maxAddable === 0}
                  className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-premium-gold disabled:opacity-40 transition-colors"
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
              className={`w-full py-4 px-8 rounded-xl text-base font-bold transition-all shadow-elevated mb-4 ${
                addedToCart
                  ? 'bg-success text-dark-bg scale-95'
                  : inventoryState.canPurchase && maxAddable > 0
                  ? 'bg-premium-gold hover:bg-premium-gold_dark text-dark-bg hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-dark-surfaceHover text-text-muted cursor-not-allowed'
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

            <p className="text-xs text-center text-text-muted">
              Las solicitudes de pedido B2B se confirman por email tras la revisión del equipo de
              ventas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
