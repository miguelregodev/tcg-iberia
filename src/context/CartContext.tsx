'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Product } from '@/types';

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

const SHIPPING_COST = 6.95;
const FREE_SHIPPING_THRESHOLD = 200;

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = items.reduce((sum, item) => {
    const price = item.product.discountPercentage
      ? Number(item.product.price) * (1 - Number(item.product.discountPercentage) / 100)
      : Number(item.product.price);
    return sum + price * item.quantity;
  }, 0);

  const shippingCost =
  totalPrice >= FREE_SHIPPING_THRESHOLD
    ? 0
    : SHIPPING_COST;

  const finalPrice = totalPrice + shippingCost;

  const addToCart = useCallback((product: Product, quantity: number) => {
    setItems(prevItems => {
      const stock = Math.max(0, Number(product.stock) || 0);
      const existingItem = prevItems.find(item => item.product.id === product.id);
      if (existingItem) {
        const desired = existingItem.quantity + quantity;
        const capped = Math.min(stock, Math.max(1, desired));
        if (capped === existingItem.quantity) return prevItems;
        return prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: capped }
            : item
        );
      }
      const initialQty = Math.min(stock, Math.max(1, quantity));
      if (initialQty <= 0) return prevItems;
      return [...prevItems, { product, quantity: initialQty }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems(prevItems => prevItems.filter(item => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.product.id !== productId) return item;
        const stock = Math.max(0, Number(item.product.stock) || 0);
        const capped = Math.min(stock, quantity);
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
