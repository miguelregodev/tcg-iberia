'use client';

import type { Properties } from 'posthog-js';
import { capturePostHogEvent, getOrCreateLocalUserId, getPostHogSessionId } from './posthog';

export type ProductEventPayload = {
  productId?: string;
  productName?: string;
  category?: string;
  price?: number;
};

export type CheckoutEventPayload = {
  orderId?: string;
  amount?: number;
  paymentMethod?: string;
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

export function trackUserRegistered(payload: Properties = {}) {
  trackEvent('user_registered', payload);
}

export function trackCategoryViewed(payload: Properties) {
  trackEvent('category_viewed', payload);
}

export function trackCollectionViewed(payload: Properties) {
  trackEvent('collection_viewed', payload);
}
