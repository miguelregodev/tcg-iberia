import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const db = {
    b2bOrder: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    b2bDocument: { findMany: vi.fn() },
    b2bOrderEvent: { create: vi.fn() },
    sequence: { update: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, shippedEmail: vi.fn(), captureException: vi.fn() };
});

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/lib/b2b/emails', () => ({ sendB2bOrderShippedEmail: mocks.shippedEmail }));

import {
  cancelB2bOrder,
  createB2bOrder,
  getCustomerB2bOrder,
  sendB2bShippingNotification,
  updateB2bFulfillment,
  updateB2bPaymentStatus,
} from './orders';

const customer = {
  id: 'cust-1',
  email: 'shop@cards.test',
  status: 'ACTIVE',
  companyName: 'Cards SL',
  vatNumber: 'B12345678',
  contactName: 'Ana',
  phone: '600',
  billingAddress: null,
  shippingAddress: 'Calle 1',
};

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    customerId: 'cust-1',
    orderNumber: 'PED-2026-000001',
    status: 'ACCEPTED',
    paymentStatus: 'PENDING',
    fulfillmentStatus: 'PENDING',
    items: [{ productId: 'p1', name: 'Box', quantity: 1, unitPriceEur: 10, lineTotal: 10 }],
    customerSnapshot: customer,
    subtotal: 10,
    discountTotal: 0,
    shippingCost: 0,
    vatRate: 0.21,
    ivaAmount: 2.1,
    total: 12.1,
    trackingNumber: null,
    shippingProvider: null,
    internalNotes: 'secret internal',
    createdBy: 'admin:x@y.z',
    createdAt: new Date('2026-11-19T10:00:00Z'),
    customer,
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: typeof mocks.db) => unknown)(mocks.db) : Promise.all(arg as unknown[])
  );
  mocks.db.b2bOrder.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.b2bOrder.findUniqueOrThrow.mockImplementation(async () => order());
  mocks.db.b2bDocument.findMany.mockResolvedValue([]);
});

const lastUpdate = () => mocks.db.b2bOrder.updateMany.mock.calls.at(-1)![0];
const eventTypes = () => mocks.db.b2bOrderEvent.create.mock.calls.map((c) => c[0].data.type);

describe('createB2bOrder', () => {
  it('persists server-priced snapshots and an admin audit event', async () => {
    mocks.db.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Box', slug: 'box', language: 'JAPANESE', imageUrl: null, b2bPrice: 121, visible: true },
    ]);
    mocks.db.sequence.update.mockResolvedValue({ value: 3 });
    mocks.db.b2bOrder.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new', ...data }));

    const { order: created, duplicate } = await createB2bOrder({
      customer: customer as never,
      lines: [{ productId: 'p1', quantity: 2, discountPercent: 50 }],
      shippingCostCents: 500,
      notes: null,
      internalNotes: 'call first',
      source: 'ADMIN',
      actor: 'admin:x@y.z',
      idempotencyKey: 'key-1234567890abcdef',
      initialStatus: 'ACCEPTED',
      rejectOnUnpricedLines: true,
    });

    expect(duplicate).toBe(false);
    const data = mocks.db.b2bOrder.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      source: 'ADMIN',
      status: 'ACCEPTED',
      subtotal: 100,
      discountTotal: 100,
      shippingCost: 5,
      ivaAmount: 22.05,
      total: 127.05,
      customerSnapshot: expect.objectContaining({ vatNumber: 'B12345678' }),
    });
    expect(data.items[0]).toMatchObject({ name: 'Box', sku: 'box', unitPriceEur: 100, lineTotal: 100 });
    expect(created).toHaveProperty('orderNumber');
    expect(eventTypes()).toEqual(['ORDER_CREATED_BY_ADMIN', 'ADMIN_NOTE_UPDATED']);
  });

  it('freezes Recargo de Equivalencia for customers under that regime', async () => {
    mocks.db.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Box', slug: 'box', language: 'JAPANESE', imageUrl: null, b2bPrice: 121, visible: true },
    ]);
    mocks.db.sequence.update.mockResolvedValue({ value: 4 });
    mocks.db.b2bOrder.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new', ...data }));

    await createB2bOrder({
      customer: { ...customer, equivalenceSurcharge: true } as never,
      lines: [{ productId: 'p1', quantity: 1, discountPercent: 0 }],
      shippingCostCents: 0,
      notes: null,
      internalNotes: null,
      source: 'ADMIN',
      actor: 'a',
      idempotencyKey: null,
      initialStatus: 'ACCEPTED',
      rejectOnUnpricedLines: true,
    });

    expect(mocks.db.b2bOrder.create.mock.calls[0][0].data).toMatchObject({
      subtotal: 100,
      ivaAmount: 21,
      surchargeRate: 0.052,
      surchargeAmount: 5.2,
      total: 126.2,
    });
  });

  it('returns the existing order for a repeated idempotency key', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order());
    const result = await createB2bOrder({
      customer: customer as never,
      lines: [{ productId: 'p1', quantity: 1, discountPercent: 0 }],
      shippingCostCents: 0,
      notes: null,
      internalNotes: null,
      source: 'ADMIN',
      actor: 'a',
      idempotencyKey: 'key-1234567890abcdef',
      initialStatus: 'ACCEPTED',
      rejectOnUnpricedLines: true,
    });
    expect(result.duplicate).toBe(true);
    expect(mocks.db.b2bOrder.create).not.toHaveBeenCalled();
  });

  it('rejects admin orders containing unpriced products', async () => {
    mocks.db.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Box', slug: 'box', language: 'JAPANESE', imageUrl: null, b2bPrice: null, visible: true },
    ]);
    await expect(
      createB2bOrder({
        customer: customer as never,
        lines: [{ productId: 'p1', quantity: 1, discountPercent: 0 }],
        shippingCostCents: 0,
        notes: null,
        internalNotes: null,
        source: 'ADMIN',
        actor: 'a',
        idempotencyKey: null,
        initialStatus: 'ACCEPTED',
        rejectOnUnpricedLines: true,
      })
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('payment management', () => {
  it('marks as paid with date/method and leaves fulfillment untouched', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order());
    await updateB2bPaymentStatus({
      orderId: 'o1',
      actor: 'admin:x@y.z',
      status: 'PAID',
      method: null,
      reference: 'TRX-1',
      paidAt: new Date('2026-11-18T12:00:00Z'),
    });
    const { where, data } = lastUpdate();
    expect(where).toEqual({ id: 'o1', status: 'ACCEPTED', paymentStatus: 'PENDING', fulfillmentStatus: 'PENDING' });
    expect(data).toEqual({
      paymentStatus: 'PAID',
      paidAt: new Date('2026-11-18T12:00:00Z'),
      paymentMethod: 'Transferencia bancaria',
      paymentReference: 'TRX-1',
    });
    expect(eventTypes()).toEqual(['PAYMENT_STATUS_CHANGED']);
  });

  it('rejects invalid transitions and future payment dates', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order({ paymentStatus: 'REFUNDED' }));
    await expect(
      updateB2bPaymentStatus({ orderId: 'o1', actor: 'a', status: 'PAID', method: null, reference: null, paidAt: null })
    ).rejects.toMatchObject({ status: 409 });

    mocks.db.b2bOrder.findUnique.mockResolvedValue(order());
    await expect(
      updateB2bPaymentStatus({ orderId: 'o1', actor: 'a', status: 'PAID', method: null, reference: null, paidAt: new Date(Date.now() + 86_400_000) })
    ).rejects.toMatchObject({ status: 422 });
  });

  it('detects concurrent modifications', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order());
    mocks.db.b2bOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateB2bPaymentStatus({ orderId: 'o1', actor: 'a', status: 'PAID', method: null, reference: null, paidAt: null })
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.db.b2bOrderEvent.create).not.toHaveBeenCalled();
  });
});

describe('cancellation and returns', () => {
  it('cancelling a paid order keeps the payment and flags refund + corrective invoice', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order({ paymentStatus: 'PAID' }));
    mocks.db.b2bDocument.findMany.mockResolvedValue([
      { id: 'inv', type: 'INVOICE', status: 'ISSUED', correctsDocumentId: null },
    ]);
    const result = await cancelB2bOrder({ orderId: 'o1', actor: 'admin:x', by: 'admin', reason: 'Sin stock' });
    expect(lastUpdate().data).toMatchObject({
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: 'PAID',
      cancellationReason: 'Sin stock',
      cancelledBy: 'admin:x',
    });
    expect(result).toMatchObject({ requiresRefund: true, requiresCorrectiveInvoice: true });
  });

  it('does not allow cancelling shipped orders', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order({ fulfillmentStatus: 'SHIPPED' }));
    await expect(cancelB2bOrder({ orderId: 'o1', actor: 'a', by: 'admin', reason: null })).rejects.toMatchObject({ status: 409 });
  });

  it("customers cannot cancel another customer's order", async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order({ customerId: 'someone-else' }));
    await expect(
      cancelB2bOrder({ orderId: 'o1', actor: 'customer', by: 'customer', reason: null, customerId: 'cust-1' })
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.db.b2bOrder.updateMany).not.toHaveBeenCalled();
  });

  it('marking as returned never changes the payment status', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order({ paymentStatus: 'PAID', fulfillmentStatus: 'DELIVERED' }));
    await updateB2bFulfillment({ orderId: 'o1', actor: 'a', status: 'RETURNED', trackingNumber: null, shippingProvider: null, reason: 'Dañado' });
    const { data } = lastUpdate();
    expect(data).toMatchObject({ fulfillmentStatus: 'RETURNED', returnReason: 'Dañado' });
    expect(data).not.toHaveProperty('paymentStatus');
    expect(eventTypes()).toEqual(['ORDER_RETURNED']);
  });
});

describe('shipping', () => {
  it('requires a valid carrier and tracking number', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order());
    await expect(
      updateB2bFulfillment({ orderId: 'o1', actor: 'a', status: 'SHIPPED', trackingNumber: 'PK123', shippingProvider: 'DHL', reason: null })
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      updateB2bFulfillment({ orderId: 'o1', actor: 'a', status: 'SHIPPED', trackingNumber: '', shippingProvider: 'CORREOS', reason: null })
    ).rejects.toMatchObject({ status: 422 });
  });

  it('ships with tracking data, leaves payment untouched and requests a notification', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(order());
    const result = await updateB2bFulfillment({
      orderId: 'o1',
      actor: 'a',
      status: 'SHIPPED',
      trackingNumber: 'PK123456789ES',
      shippingProvider: 'CORREOS',
      reason: null,
    });
    expect(result.shouldNotify).toBe(true);
    const { data } = lastUpdate();
    expect(data).toMatchObject({ fulfillmentStatus: 'SHIPPED', trackingNumber: 'PK123456789ES', shippingProvider: 'CORREOS' });
    expect(data).not.toHaveProperty('paymentStatus');
  });

  it('records tracking/carrier changes on shipped orders without re-notifying', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(
      order({ fulfillmentStatus: 'SHIPPED', trackingNumber: 'OLD123', shippingProvider: 'MRW' })
    );
    const result = await updateB2bFulfillment({
      orderId: 'o1',
      actor: 'a',
      status: 'SHIPPED',
      trackingNumber: 'NEW456',
      shippingProvider: 'SEUR',
      reason: null,
    });
    expect(result.shouldNotify).toBe(false);
    expect(eventTypes()).toEqual(['TRACKING_UPDATED', 'CARRIER_CHANGED']);
  });

  it('a failed shipping email is recorded and never undoes the shipment', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(
      order({ fulfillmentStatus: 'SHIPPED', trackingNumber: 'PK1', shippingProvider: 'CORREOS' })
    );
    mocks.db.b2bOrder.update.mockResolvedValue({});
    mocks.shippedEmail.mockRejectedValue(Object.assign(new Error('smtp down'), { name: 'SMTPError' }));

    const result = await sendB2bShippingNotification({ orderId: 'o1', actor: 'a', orderUrl: 'https://x/o1', isRetry: false });

    expect(result).toEqual({ sent: false, error: expect.stringContaining('SMTPError') });
    expect(mocks.db.b2bOrder.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { shippingEmailError: result.error },
    });
    expect(mocks.db.b2bOrder.updateMany).not.toHaveBeenCalled();
    expect(eventTypes()).toEqual(['SHIPPING_EMAIL_FAILED']);
  });

  it('a retried shipping email records the retry and the success', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(
      order({ fulfillmentStatus: 'SHIPPED', trackingNumber: 'PK1', shippingProvider: 'CORREOS' })
    );
    mocks.db.b2bOrder.update.mockResolvedValue({});
    mocks.shippedEmail.mockResolvedValue(undefined);

    const result = await sendB2bShippingNotification({ orderId: 'o1', actor: 'a', orderUrl: 'https://x/o1', isRetry: true });

    expect(result.sent).toBe(true);
    expect(mocks.shippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ shippingProvider: 'CORREOS', trackingNumber: 'PK1', orderUrl: 'https://x/o1' })
    );
    expect(eventTypes()).toEqual(['SHIPPING_EMAIL_RETRIED', 'SHIPPING_EMAIL_SENT']);
  });
});

describe('customer projection', () => {
  it('scopes the query to the customer and never exposes internal data', async () => {
    mocks.db.b2bOrder.findFirst.mockResolvedValue({
      ...order({ fulfillmentStatus: 'SHIPPED', trackingNumber: 'PK1', shippingProvider: 'CORREOS', paymentStatus: 'PAID' }),
      documents: [
        { id: 'd1', type: 'INVOICE', status: 'ISSUED', number: 'FAC-1', issuedAt: new Date(), total: 12.1, correctsDocumentId: null },
        { id: 'd2', type: 'PROFORMA', status: 'FAILED', number: 'PRO-1', issuedAt: new Date(), total: 12.1, correctsDocumentId: null },
      ],
    });
    const detail = await getCustomerB2bOrder('cust-1', 'o1');
    expect(mocks.db.b2bOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', customerId: 'cust-1' } })
    );
    expect(detail.paymentStatus).toBe('PAID');
    expect(detail.fulfillmentStatus).toBe('SHIPPED');
    expect(detail.trackingUrl).toContain('PK1');
    expect(detail.documents.map((d) => d.number)).toEqual(['FAC-1']);
    const json = JSON.stringify(detail);
    expect(json).not.toContain('secret internal');
    expect(json).not.toContain('admin:x@y.z');
    expect(json).not.toContain('storageKey');
  });

  it('returns 404 for orders of other customers', async () => {
    mocks.db.b2bOrder.findFirst.mockResolvedValue(null);
    await expect(getCustomerB2bOrder('cust-2', 'o1')).rejects.toMatchObject({ status: 404 });
  });
});
