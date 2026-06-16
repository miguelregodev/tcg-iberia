'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect, useRef } from 'react';
import { Product } from '@/types';
import { trackPreorderAddedToCart, trackProductAddedToCart, trackProductRemovedFromCart } from '@/lib/analytics/events';
import { calculateSubtotal, getFreeShippingState } from '@/lib/shipping/free-shipping';
import { getProductInventoryState, getProductQuantityLimit } from '@/lib/products/state';
import { CartItemSnapshot } from '@/lib/abandoned-cart/tracker';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  totalQuantity: number;
  totalPrice: number;
  shippingCost: number;
  finalPrice: number;
  cartSessionKey: string;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Stable, client-generated UUID that identifies this cart session across page
  // loads. Stored in localStorage so the same key survives refreshes.
  const [cartSessionKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const stored = localStorage.getItem('cart-session-key');
      if (stored) return stored;
      const key = crypto.randomUUID();
      localStorage.setItem('cart-session-key', key);
      return key;
    } catch {
      return '';
    }
  });

  // Debounce ref — cleared/reset on each cart mutation.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fire-and-forget sync to the abandoned-cart API. 2-second debounce. */
  const scheduleSyncRef = useRef<(nextItems: CartItem[], nextTotal: number) => void>(() => {});

  useEffect(() => {
    scheduleSyncRef.current = (nextItems: CartItem[], nextTotal: number) => {
      if (!cartSessionKey) return;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(async () => {
        try {
          const snapshots: CartItemSnapshot[] = nextItems.map((ci) => ({
            id: ci.product.id,
            name: ci.product.name,
            quantity: ci.quantity,
            price: Number(ci.product.price),
            discountPercentage: ci.product.discountPercentage ?? null,
            imageUrl: ci.product.imageUrl ?? null,
          }));
          await fetch('/api/cart/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionKey: cartSessionKey,
              items: snapshots,
              totalAmount: nextTotal,
            }),
          });
        } catch {
          // Silent — cart sync is best-effort and must never break the UI.
        }
      }, 2000);
    };
  }, [cartSessionKey]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () =>
      calculateSubtotal(
        items.map((item) => ({
          price: Number(item.product.price),
          quantity: item.quantity,
          discountPercentage: item.product.discountPercentage,
        }))
      ),
    [items]
  );

  const freeShippingState = useMemo(() => getFreeShippingState(totalPrice), [totalPrice]);
  const shippingCost = freeShippingState.shippingCost;
  const finalPrice = totalPrice + shippingCost;

  const addToCart = useCallback((product: Product, quantity: number) => {
    setItems(prevItems => {
      const state = getProductInventoryState({
        stock: product.stock,
        releaseDate: product.releaseDate,
      });
      const stock = Math.max(0, Number(product.stock) || 0);
      const quantityLimit = getProductQuantityLimit(state);
      const existingItem = prevItems.find(item => item.product.id === product.id);
      if (existingItem) {
        const desired = existingItem.quantity + quantity;
        const capped = quantityLimit === null
          ? Math.max(1, desired)
          : Math.min(stock, Math.max(1, desired));
        if (capped === existingItem.quantity) return prevItems;
        const next = prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: capped }
            : item
        );
        const total = calculateSubtotal(next.map(i => ({ price: Number(i.product.price), quantity: i.quantity, discountPercentage: i.product.discountPercentage })));
        scheduleSyncRef.current(next, total);
        return next;
      }
      const initialQty = quantityLimit === null
        ? Math.max(1, quantity)
        : Math.min(stock, Math.max(1, quantity));
      if (initialQty <= 0) return prevItems;

      trackProductAddedToCart({
        productId: product.id,
        productName: product.name,
        category: product.type ?? 'unknown',
        price: Number(product.price),
        releaseDate: product.releaseDate ?? undefined,
      });

      if (state.isPreorder && product.releaseDate) {
        trackPreorderAddedToCart({
          productId: product.id,
          productName: product.name,
          releaseDate: product.releaseDate,
        });
      }

      const next = [...prevItems, { product, quantity: initialQty }];
      const total = calculateSubtotal(next.map(i => ({ price: Number(i.product.price), quantity: i.quantity, discountPercentage: i.product.discountPercentage })));
      scheduleSyncRef.current(next, total);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems(prevItems => {
      const removed = prevItems.find(item => item.product.id === productId);
      if (removed) {
        trackProductRemovedFromCart({
          productId: removed.product.id,
          productName: removed.product.name,
          category: removed.product.type ?? 'unknown',
          price: Number(removed.product.price),
        });
      }
      const next = prevItems.filter(item => item.product.id !== productId);
      const total = calculateSubtotal(next.map(i => ({ price: Number(i.product.price), quantity: i.quantity, discountPercentage: i.product.discountPercentage })));
      scheduleSyncRef.current(next, total);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prevItems => {
      const next = prevItems.map(item => {
        if (item.product.id !== productId) return item;
        const state = getProductInventoryState({
          stock: item.product.stock,
          releaseDate: item.product.releaseDate,
        });
        const stock = Math.max(0, Number(item.product.stock) || 0);
        const quantityLimit = getProductQuantityLimit(state);
        const capped = quantityLimit === null ? quantity : Math.min(stock, quantity);
        return { ...item, quantity: capped };
      });
      const total = calculateSubtotal(next.map(i => ({ price: Number(i.product.price), quantity: i.quantity, discountPercentage: i.product.discountPercentage })));
      scheduleSyncRef.current(next, total);
      return next;
    });
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
    scheduleSyncRef.current([], 0);
  }, []);

  const value: CartContextType = {
    items,
    totalQuantity,
    totalPrice,
    shippingCost,
    finalPrice,
    cartSessionKey,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
