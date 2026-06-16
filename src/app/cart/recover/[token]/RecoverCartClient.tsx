'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { useCart } from '@/context/CartContext';
import { CartItemSnapshot } from '@/lib/abandoned-cart/tracker';
import { trackEvent } from '@/lib/analytics/events';

interface Props {
  token: string;
}

export function RecoverCartClient({ token }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const restore = async () => {
      try {
        const res = await fetch(`/api/cart/recover/${token}`);
        if (!res.ok) {
          router.replace('/');
          return;
        }

        const { items, sessionKey } = (await res.json()) as {
          items: CartItemSnapshot[];
          sessionKey: string;
          totalAmount: number;
        };

        // Restore the session key in localStorage so the cart syncs correctly.
        try {
          localStorage.setItem('cart-session-key', sessionKey);
        } catch {/* ignore */}

        for (const snapshot of items) {
          // Build a minimal Product shape that addToCart accepts.
          addToCart(
            {
              id: snapshot.id,
              name: snapshot.name,
              price: snapshot.price,
              discountPercentage: snapshot.discountPercentage ?? null,
              imageUrl: snapshot.imageUrl ?? null,
              stock: 999, // preorder / recovery — no stock cap needed
              isPreorder: false,
              canPurchase: true,
              available: true,
              inventoryStatus: 'available',
              releaseDate: null,
              // Fields required by Product type but not used in cart
              slug: '',
              description: '',
              type: null,
              language: 'ENGLISH',
              priority: 999,
              visible: true,
              notes: null,
              hitCards: [],
              createdAt: '',
              updatedAt: '',
            },
            snapshot.quantity,
          );
        }

        trackEvent('abandoned_cart_link_clicked', {
          itemCount: items.length,
        });

        router.replace('/checkout');
      } catch (err) {
        Sentry.captureException(err, { tags: { module: 'cart_recovery_client' } });
        router.replace('/');
      }
    };

    restore();
  }, [token, addToCart, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4" />
        <p className="text-gray-600 text-lg">Recuperando tu carrito…</p>
      </div>
    </div>
  );
}
