/**
 * Which payment statuses make an order "retriable" from checkout — i.e. safe to
 * update in place (new items/totals/redsysOrderId, reset to PENDING_PAYMENT) instead
 * of creating a duplicate order. PAID and CANCELLED orders are never retried.
 */
export type RetriablePaymentStatus = 'PENDING_PAYMENT' | 'PAYMENT_FAILED';

const RETRIABLE_PAYMENT_STATUSES: readonly RetriablePaymentStatus[] = [
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
];

export function isRetriablePaymentStatus(status: string): status is RetriablePaymentStatus {
  return (RETRIABLE_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export { RETRIABLE_PAYMENT_STATUSES };
