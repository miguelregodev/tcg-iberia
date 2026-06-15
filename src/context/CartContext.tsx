'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { Product } from '@/types';
import { trackPreorderAddedToCart, trackProductAddedToCart, trackProductRemovedFromCart } from '@/lib/analytics/events';
import { calculateSubtotal, getFreeShippingState } from '@/lib/shipping/free-shipping';
import { getProductInventoryState, getProductQuantityLimit } from '@/lib/products/state';

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
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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
        return prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: capped }
            : item
        );
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

      return [...prevItems, { product, quantity: initialQty }];
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
      return prevItems.filter(item => item.product.id !== productId);
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.product.id !== productId) return item;
        const state = getProductInventoryState({
          stock: item.product.stock,
          releaseDate: item.product.releaseDate,
        });
        const stock = Math.max(0, Number(item.product.stock) || 0);
        const quantityLimit = getProductQuantityLimit(state);
        const capped = quantityLimit === null ? quantity : Math.min(stock, quantity);
        return { ...item, quantity: capped };
      })
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value: CartContextType = {
    items,
    totalQuantity,
    totalPrice,
    shippingCost,
    finalPrice,
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
