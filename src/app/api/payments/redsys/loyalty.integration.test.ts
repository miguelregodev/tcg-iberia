import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: null as Prisma.TransactionClient | null,
  userId: '',
  redsysOrderId: '123456789012',
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: (fn: (tx: Prisma.TransactionClient) => unknown) => fn(mocks.tx!),
    get product() { return mocks.tx!.product; },
    get order() { return mocks.tx!.order; },
  },
}));
vi.mock('@/lib/auth', () => ({ auth: () => Promise.resolve({ user: { id: mocks.userId } }) }));
vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyCheckoutEnabled: () => true }));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: vi.fn() }));
vi.mock('@/lib/analytics/posthog-server', () => ({ captureServerEvent: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendOrderEmails: vi.fn() }));
vi.mock('@/lib/payments/redsys/orderId', () => ({ nextRedsysOrderId: () => Promise.resolve(mocks.redsysOrderId) }));
vi.mock('@/lib/payments/redsys/config', () => ({
  getRedsysConfig: () => ({ merchantCode: 'test', terminal: '1' }),
  getRedsysApiUrl: () => 'https://test.example',
}));
vi.mock('@/lib/payments/redsys/signature', () => ({
  toBase64: (value: string) => Buffer.from(value).toString('base64'),
  fromBase64: (value: string) => Buffer.from(value, 'base64'),
  generateSignature: () => 'test-signature',
  verifySignature: () => true,
}));
vi.mock('@/lib/parties/payment', () => ({ processPartyParticipationPayment: () => Promise.resolve(null) }));
vi.mock('@/lib/payments/shipmentPaymentService', () => ({
  handleShipmentPaymentSuccess: vi.fn(), handleShipmentPaymentFailure: vi.fn(), verifyShipmentPaymentAmount: vi.fn(),
}));

import { POST as createPayment } from './create/route';
import { POST as notification } from './notification/route';
import { applyManualAdjustment } from '@/lib/loyalty/ledger';

const enabled = process.env.LOYALTY_INTEGRATION_TEST === '1';

describe.skipIf(!enabled)('loyalty checkout payment integration', () => {
  it('reserves the server-priced discount and settles exactly once on confirmed payment', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    const { db } = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
    const rollback = new Error('test rollback');
    try {
      await db.$transaction(async (tx) => {
        mocks.tx = tx;
        const id = randomUUID();
        const user = await tx.user.create({ data: { email: `${id}@example.test` } });
        mocks.userId = user.id;
        const product = await tx.product.create({
          data: { name: 'Producto de prueba', slug: id, description: 'Prueba', price: '121', stock: 5, visible: true },
        });
        await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { enabled: true } });
        await applyManualAdjustment(tx, {
          userId: user.id, adminActor: 'admin:test@example.test', points: '1000',
          reason: 'Prueba', idempotencyKey: randomUUID(), now: new Date(),
        });
        const request = new NextRequest('http://localhost/api/payments/redsys/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: product.id, name: product.name, price: 1, quantity: 1 }],
            customerData: {
              fullName: 'Prueba', email: user.email, phone: '123', shippingAddress: 'Prueba',
              shippingPostalCode: '28001', shippingCity: 'Madrid', shippingLocality: 'Madrid', shippingProvince: 'Madrid',
            },
            groupedShipping: true, cartId: id, loyaltyPoints: '100', loyaltyExpectedTotal: '120.00',
          }),
        });
        const created = await createPayment(request);
        expect(created.status).toBe(200);
        const response = await created.json();
        const params = JSON.parse(Buffer.from(response.Ds_MerchantParameters, 'base64').toString());
        expect(params.DS_MERCHANT_AMOUNT).toBe('12000');
        const order = await tx.order.findUniqueOrThrow({ where: { orderNumber: response.orderNumber }, include: { loyaltyRedemption: true } });
        expect(order.totalAmount.toString()).toBe('120');
        expect(order.loyaltyRedemption?.status).toBe('RESERVED');
        const notificationRequest = () => new NextRequest('http://localhost/api/payments/redsys/notification', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            Ds_Signature: 'signed', Ds_SignatureVersion: 'HMAC_SHA256_V1',
            Ds_MerchantParameters: Buffer.from(JSON.stringify({
              Ds_Order: mocks.redsysOrderId, Ds_Response: '0000', Ds_Amount: '12000', Ds_Currency: '978',
            })).toString('base64'),
          }),
        });
        expect((await notification(notificationRequest())).status).toBe(200);
        expect((await notification(notificationRequest())).status).toBe(200);
        const paid = await tx.order.findUniqueOrThrow({
          where: { id: order.id }, include: { loyaltyReward: true, loyaltyRedemption: true },
        });
        expect(paid.paymentStatus).toBe('PAID');
        expect(paid.loyaltyRedemption?.status).toBe('SETTLED');
        expect(paid.loyaltyReward?.pointsEarned.toString()).toBe('121');
        expect(await tx.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(2);
        expect((await tx.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(4);
        mocks.redsysOrderId = '123456789013';
        const failedRequest = new NextRequest('http://localhost/api/payments/redsys/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: product.id, name: product.name, price: 1, quantity: 1 }],
            customerData: {
              fullName: 'Prueba', email: user.email, phone: '123', shippingAddress: 'Prueba',
              shippingPostalCode: '28001', shippingCity: 'Madrid', shippingLocality: 'Madrid', shippingProvince: 'Madrid',
            },
            groupedShipping: true, cartId: `${id}-failed`, loyaltyPoints: '100', loyaltyExpectedTotal: '120.00',
          }),
        });
        const secondResponse = await createPayment(failedRequest);
        expect(secondResponse.status).toBe(200);
        const second = await secondResponse.json();
        const failedNotification = () => new NextRequest('http://localhost/api/payments/redsys/notification', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            Ds_Signature: 'signed', Ds_SignatureVersion: 'HMAC_SHA256_V1',
            Ds_MerchantParameters: Buffer.from(JSON.stringify({
              Ds_Order: mocks.redsysOrderId, Ds_Response: '0101', Ds_Amount: '12000', Ds_Currency: '978',
            })).toString('base64'),
          }),
        });
        expect((await notification(failedNotification())).status).toBe(200);
        expect((await notification(failedNotification())).status).toBe(200);
        const failed = await tx.order.findUniqueOrThrow({
          where: { orderNumber: second.orderNumber }, include: { loyaltyReward: true, loyaltyRedemption: true },
        });
        expect(failed.paymentStatus).toBe('PAYMENT_FAILED');
        expect(failed.loyaltyReward).toBeNull();
        expect(failed.loyaltyRedemption?.status).toBe('RELEASED');
        expect((await tx.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(4);
        throw rollback;
      }, { timeout: 20_000 });
      throw new Error('Test transaction did not roll back');
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      mocks.tx = null;
    }
  });
});
