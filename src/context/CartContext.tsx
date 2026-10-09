'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
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
  /** Stable id for the current shopping cart, persisted in localStorage. Sent to checkout
   * so a retried/abandoned payment attempt updates the same Order instead of duplicating it. */
  cartId: string;
  /** True once the cart has finished loading from localStorage on mount. */
  isHydrated: boolean;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  /** Overwrites price/discount of cart lines (keyed by cart product id) with current catalog values. */
  updateItemPricing: (updates: CartPricingUpdate[]) => void;
  clearCart: () => void;
}

export interface CartPricingUpdate {
  productId: string;
  price: number;
  discountPercentage: number | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'tcg-iberia-cart';
const CART_ID_STORAGE_KEY = 'tcg-iberia-cart-id';

function generateCartId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Sellado and Apertura en Directo (`_live` suffix) are separate cart lines but
// draw from the same physical stock, so quantity caps must be computed jointly.
function getBaseProductId(productId: string): string {
  return productId.replace(/_live$/, '');
}

function getOtherVariantQuantity(items: CartItem[], productId: string): number {
  const baseId = getBaseProductId(productId);
  return items
    .filter(item => item.product.id !== productId && getBaseProductId(item.product.id) === baseId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart (and cart id) from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartItem[];
        setItems(parsed);
      }

      let storedCartId = localStorage.getItem(CART_ID_STORAGE_KEY);
      if (!storedCartId) {
        storedCartId = generateCartId();
        localStorage.setItem(CART_ID_STORAGE_KEY, storedCartId);
      }
      setCartId(storedCartId);
    } catch (err) {
      console.error('Failed to load cart from localStorage:', err);
    }
    setIsHydrated(true);
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (!isHydrated) return; // Don't save during hydration
    try {
      if (items.length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      }
    } catch (err) {
      console.error('Failed to save cart to localStorage:', err);
    }
  }, [items, isHydrated]);

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
      const sharedStockUsed = getOtherVariantQuantity(prevItems, product.id);
      const availableStock = Math.max(0, stock - sharedStockUsed);
      const existingItem = prevItems.find(item => item.product.id === product.id);
      if (existingItem) {
        const desired = existingItem.quantity + quantity;
        const capped = quantityLimit === null
          ? Math.max(1, desired)
          : Math.min(availableStock, Math.max(1, desired));
        if (capped === existingItem.quantity) return prevItems;
        return prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: capped }
            : item
        );
      }
      const initialQty = quantityLimit === null
        ? Math.max(1, quantity)
        : Math.min(availableStock, Math.max(1, quantity));
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
        const sharedStockUsed = getOtherVariantQuantity(prevItems, item.product.id);
        const availableStock = Math.max(0, stock - sharedStockUsed);
        const capped = quantityLimit === null ? quantity : Math.min(availableStock, quantity);
        return { ...item, quantity: capped };
      })
    );
  }, [removeFromCart]);

  const updateItemPricing = useCallback((updates: CartPricingUpdate[]) => {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.productId, u]));
    setItems(prevItems =>
      prevItems.map(item => {
        const update = byId.get(item.product.id);
        if (!update) return item;
        return {
          ...item,
          product: {
            ...item.product,
            price: update.price,
            discountPercentage: update.discountPercentage,
          },
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    // A fresh cart id marks this shopping session as fully closed (e.g. after a
    // successful payment) so a later checkout always starts a brand-new order.
    try {
      const newCartId = generateCartId();
      localStorage.setItem(CART_ID_STORAGE_KEY, newCartId);
      setCartId(newCartId);
    } catch (err) {
      console.error('Failed to reset cart id in localStorage:', err);
    }
  }, []);

  const value: CartContextType = {
    items,
    totalQuantity,
    totalPrice,
    shippingCost,
    finalPrice,
    cartId,
    isHydrated,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemPricing,
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
