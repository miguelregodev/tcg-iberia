import { describe, expect, it } from 'vitest';
import {
  allowedFulfillmentTargets,
  allowedPaymentTargets,
  canCancel,
  canChangeFulfillment,
  canChangePayment,
  getDocumentEligibility,
  paymentStatusAfterCancel,
  type B2bOrderState,
  type DocumentState,
} from './order-status';

const state = (over: Partial<B2bOrderState> = {}): B2bOrderState => ({
  status: 'ACCEPTED',
  paymentStatus: 'PENDING',
  fulfillmentStatus: 'PENDING',
  ...over,
});

describe('independent payment / fulfillment statuses', () => {
  it('allows paid-but-not-shipped and shipped-but-not-paid', () => {
    expect(canChangePayment(state(), 'PAID').ok).toBe(true);
    expect(canChangeFulfillment(state({ paymentStatus: 'PENDING' }), 'SHIPPED').ok).toBe(true);
  });

  it('only confirmed orders can be paid or prepared', () => {
    expect(canChangePayment(state({ status: 'PENDING' }), 'PAID').ok).toBe(false);
    expect(canChangeFulfillment(state({ status: 'PENDING' }), 'PROCESSING').ok).toBe(false);
  });

  it('validates payment transitions', () => {
    expect(allowedPaymentTargets(state())).toEqual(['PAID', 'CANCELLED']);
    expect(allowedPaymentTargets(state({ paymentStatus: 'PAID' }))).toEqual(['PENDING', 'REFUNDED']);
    expect(allowedPaymentTargets(state({ paymentStatus: 'REFUNDED' }))).toEqual([]);
    expect(canChangePayment(state({ paymentStatus: 'PENDING' }), 'REFUNDED').ok).toBe(false);
    // A cancelled order still accepts a refund of the collected payment.
    expect(canChangePayment(state({ status: 'CANCELLED', paymentStatus: 'PAID' }), 'REFUNDED').ok).toBe(true);
  });

  it('validates fulfillment transitions', () => {
    expect(allowedFulfillmentTargets(state())).toEqual(['PROCESSING', 'SHIPPED']);
    expect(allowedFulfillmentTargets(state({ fulfillmentStatus: 'SHIPPED' }))).toEqual(['DELIVERED', 'RETURNED']);
    expect(canChangeFulfillment(state({ fulfillmentStatus: 'PENDING' }), 'RETURNED').ok).toBe(false);
    expect(canChangeFulfillment(state({ fulfillmentStatus: 'RETURNED' }), 'SHIPPED').ok).toBe(false);
    expect(canChangeFulfillment(state(), 'CANCELLED').ok).toBe(false);
    // Re-sending SHIPPED for a shipped order = tracking update.
    expect(canChangeFulfillment(state({ fulfillmentStatus: 'SHIPPED' }), 'SHIPPED').ok).toBe(true);
  });
});

describe('cancellation', () => {
  it('admins can cancel unshipped orders, never shipped ones', () => {
    expect(canCancel(state({ paymentStatus: 'PAID', fulfillmentStatus: 'PROCESSING' }), 'admin').ok).toBe(true);
    expect(canCancel(state({ fulfillmentStatus: 'SHIPPED' }), 'admin').ok).toBe(false);
    expect(canCancel(state({ status: 'REJECTED' }), 'admin').ok).toBe(false);
  });

  it('customers cannot cancel paid or in-preparation orders', () => {
    expect(canCancel(state({ status: 'PENDING' }), 'customer').ok).toBe(true);
    expect(canCancel(state({ paymentStatus: 'PAID' }), 'customer').ok).toBe(false);
    expect(canCancel(state({ fulfillmentStatus: 'PROCESSING' }), 'customer').ok).toBe(false);
  });

  it('never auto-refunds: a PAID payment stays PAID after cancelling', () => {
    expect(paymentStatusAfterCancel('PAID')).toBe('PAID');
    expect(paymentStatusAfterCancel('PENDING')).toBe('CANCELLED');
  });
});

describe('document eligibility', () => {
  const invoice = (over: Partial<DocumentState> = {}): DocumentState => ({
    id: 'inv-1',
    type: 'INVOICE',
    status: 'ISSUED',
    correctsDocumentId: null,
    ...over,
  });

  it('allows a later invoice for an order created without documents', () => {
    expect(getDocumentEligibility(state(), [], 'INVOICE').ok).toBe(true);
  });

  it('prevents duplicate final invoices and asks to retry failed ones', () => {
    const dup = getDocumentEligibility(state(), [invoice()], 'INVOICE');
    expect(dup).toMatchObject({ ok: false, error: expect.stringMatching(/rectificativa/) });
    const failed = getDocumentEligibility(state(), [invoice({ status: 'FAILED' })], 'INVOICE');
    expect(failed).toMatchObject({ ok: false, error: expect.stringMatching(/reinténtalo/) });
  });

  it('allows re-invoicing only once the previous invoice has been rectified', () => {
    const docs: DocumentState[] = [
      invoice(),
      { id: 'rect-1', type: 'CORRECTIVE_INVOICE', status: 'ISSUED', correctsDocumentId: 'inv-1' },
    ];
    expect(getDocumentEligibility(state(), docs, 'INVOICE').ok).toBe(true);
    expect(getDocumentEligibility(state(), docs, 'CORRECTIVE_INVOICE', 'inv-1').ok).toBe(false);
  });

  it('requires an issued invoice to rectify', () => {
    expect(getDocumentEligibility(state(), [invoice()], 'CORRECTIVE_INVOICE', 'inv-1').ok).toBe(true);
    expect(getDocumentEligibility(state(), [invoice({ status: 'FAILED' })], 'CORRECTIVE_INVOICE', 'inv-1').ok).toBe(false);
    expect(getDocumentEligibility(state(), [], 'CORRECTIVE_INVOICE', 'nope').ok).toBe(false);
  });

  it('preliminary documents are not allowed once invoiced or on closed orders', () => {
    expect(getDocumentEligibility(state({ status: 'PENDING' }), [], 'QUOTATION').ok).toBe(true);
    expect(getDocumentEligibility(state(), [invoice()], 'PROFORMA').ok).toBe(false);
    expect(getDocumentEligibility(state({ status: 'CANCELLED' }), [], 'PROFORMA').ok).toBe(false);
    expect(getDocumentEligibility(state({ status: 'PENDING' }), [], 'INVOICE').ok).toBe(false);
  });
});
