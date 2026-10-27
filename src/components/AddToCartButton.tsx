'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useB2BSession } from '@/context/B2BSessionContext';
import { getProductInventoryState, getProductQuantityLimit } from '@/lib/products/state';

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const router = useRouter();
  const { addToCart, items } = useCart();
  const { isB2B } = useB2BSession();
  const [added, setAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // B2B customers order through the B2B flow, not the public cart.
  if (isB2B) return null;

  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const quantityLimit = getProductQuantityLimit(inventoryState);
  // Sellado and live-opening cart lines share one stock pool.
  const inCartQuantity = items
    .filter((it) => it.product.id === product.id || it.product.id === `${product.id}_live`)
    .reduce((sum, it) => sum + it.quantity, 0);
  const limitReached = quantityLimit !== null && inCartQuantity >= quantityLimit;
  const disabled = !inventoryState.canPurchase || limitReached;
  // Live-opening products need a format choice, which only the detail page offers.
  const needsOptions = product.liveOpeningPrice != null;

  const handleClick = () => {
    if (needsOptions) {
      router.push(`/product/${product.slug}`);
      return;
    }
    if (disabled) return;
    addToCart(product, 1);
    setAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAdded(false), 2000);
  };

  const label = needsOptions
    ? `Ver opciones de ${product.name}`
    : !inventoryState.canPurchase
      ? `${product.name} no disponible`
      : limitReached
        ? `Máximo de ${product.name} en el carrito`
        : `Añadir ${product.name} al carrito`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled && !needsOptions}
        aria-label={label}
        title={label}
        className={`relative z-10 flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold ${
          disabled && !needsOptions
            ? 'bg-dark-surfaceHover text-text-muted cursor-not-allowed'
            : added
              ? 'bg-success text-dark-bg'
              : 'btn-primary'
        }`}
      >
        <img
          src="/images/add-to-cart.png"
          alt=""
          className={`w-5 h-5 ${(disabled && !needsOptions) || added ? 'icon-invert' : ''}`}
        />
      </button>
      <span className="sr-only" aria-live="polite">
        {added ? `${product.name} añadido al carrito` : ''}
      </span>
    </>
  );
}
