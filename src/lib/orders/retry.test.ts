import { describe, expect, it } from 'vitest';
import { isRetriablePaymentStatus, RETRIABLE_PAYMENT_STATUSES } from './retry';

describe('isRetriablePaymentStatus', () => {
  it('treats a still-pending payment as retriable (abandoned/resumed checkout)', () => {
    expect(isRetriablePaymentStatus('PENDING_PAYMENT')).toBe(true);
  });

  it('treats a failed payment as retriable', () => {
    expect(isRetriablePaymentStatus('PAYMENT_FAILED')).toBe(true);
  });

  it('never retries an already-paid order', () => {
    expect(isRetriablePaymentStatus('PAID')).toBe(false);
  });

  it('never retries a cancelled order', () => {
    expect(isRetriablePaymentStatus('CANCELLED')).toBe(false);
  });

  it('exports exactly the two retriable statuses', () => {
    expect(RETRIABLE_PAYMENT_STATUSES).toEqual(['PENDING_PAYMENT', 'PAYMENT_FAILED']);
  });
});
