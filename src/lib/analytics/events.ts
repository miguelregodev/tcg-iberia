'use client';

import type { Properties } from 'posthog-js';
import { capturePostHogEvent, getOrCreateLocalUserId, getPostHogSessionId } from './posthog';

export type ProductEventPayload = {
  productId?: string;
  productName?: string;
  category?: string;
  price?: number;
  releaseDate?: string;
};

export type CheckoutEventPayload = {
  orderId?: string;
  amount?: number;
  paymentMethod?: string;
};

export type FreeShippingPayload = {
  cartValue: number;
  threshold: number;
  remainingAmount?: number;
  percentage?: number;
  context?: 'cart' | 'mini_cart' | 'checkout';
};

export type PreorderEventPayload = {
  productId: string;
  productName: string;
  releaseDate: string;
  orderId?: string;
};

function withCommonProperties(properties: Properties = {}): Properties {
  const page = typeof window !== 'undefined' ? window.location.pathname : 'server';
  return {
    timestamp: new Date().toISOString(),
    page,
    userId: getOrCreateLocalUserId(),
    sessionId: getPostHogSessionId(),
    ...properties,
  };
}

export function trackEvent(eventName: string, properties: Properties = {}) {
  capturePostHogEvent(eventName, withCommonProperties(properties));
}

export function trackProductViewed(payload: ProductEventPayload) {
  trackEvent('product_viewed', payload);
}

export function trackProductSearch(payload: Properties) {
  trackEvent('product_search', payload);
}

export function trackProductAddedToCart(payload: ProductEventPayload) {
  trackEvent('product_added_to_cart', payload);
}

export function trackProductRemovedFromCart(payload: ProductEventPayload) {
  trackEvent('product_removed_from_cart', payload);
}

export function trackCheckoutStarted(payload: CheckoutEventPayload) {
  trackEvent('checkout_started', payload);
}

export function trackCheckoutCompleted(payload: CheckoutEventPayload) {
  trackEvent('checkout_completed', payload);
}

export function trackCheckoutFailed(payload: CheckoutEventPayload & { reason?: string }) {
  trackEvent('checkout_failed', payload);
}

export function trackUserLoggedIn(payload: Properties = {}) {
  trackEvent('user_logged_in', payload);
}

export function trackUserLoggedOut(payload: Properties = {}) {
  trackEvent('user_logged_out', payload);
}

export function trackUserRegistered(payload: Properties = {}) {
  trackEvent('user_registered', payload);
}

export function trackCategoryViewed(payload: Properties) {
  trackEvent('category_viewed', payload);
}

export function trackCollectionViewed(payload: Properties) {
  trackEvent('collection_viewed', payload);
}

export function trackFavoriteAdded(payload: ProductEventPayload) {
  trackEvent('favorite_added', payload);
}

export function trackFavoriteRemoved(payload: ProductEventPayload) {
  trackEvent('favorite_removed', payload);
}

export function trackStockAlertCreated(payload: ProductEventPayload & { emailDomain?: string }) {
  trackEvent('stock_alert_created', payload);
}

export function trackStockAlertRemoved(payload: ProductEventPayload & { emailDomain?: string }) {
  trackEvent('stock_alert_removed', payload);
}

export function trackFreeShippingProgressViewed(payload: FreeShippingPayload) {
  trackEvent('free_shipping_progress_viewed', payload);
}

export function trackFreeShippingQualified(payload: FreeShippingPayload) {
  trackEvent('free_shipping_qualified', payload);
}

export function trackPreorderViewed(payload: PreorderEventPayload) {
  trackEvent('preorder_viewed', payload);
}

export function trackPreorderAddedToCart(payload: PreorderEventPayload) {
  trackEvent('preorder_added_to_cart', payload);
}

// --- Abandoned cart ---

export type AbandonedCartEventPayload = {
  cartId?: string;
  productCount?: number;
  cartValue?: number;
};

export type AbandonedCartConversionPayload = {
  recoveredRevenue?: number;
  productCount?: number;
};

export function trackCartAbandoned(payload: AbandonedCartEventPayload) {
  trackEvent('cart_abandoned', payload);
}

export function trackAbandonedCartEmailSent(payload: AbandonedCartEventPayload) {
  trackEvent('abandoned_cart_email_sent', payload);
}

export function trackAbandonedCartRecovered(payload: AbandonedCartEventPayload & { orderId?: string }) {
  trackEvent('abandoned_cart_recovered', payload);
}

export function trackAbandonedCartConversion(payload: AbandonedCartConversionPayload) {
  trackEvent('abandoned_cart_conversion', payload);
}
