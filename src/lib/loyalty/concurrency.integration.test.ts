import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { applyManualAdjustment } from './ledger';
import { reserveRedemption } from './redemption';

const enabled = process.env.LOYALTY_ISOLATED_TEST === '1';

describe.skipIf(!enabled)('concurrent loyalty redemptions', () => {
  it('allows only one reservation when two orders compete for the same points', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    expect(url.pathname).toMatch(/^\/loyalty_test_[0-9a-f]{32}$/);
    const id = randomUUID();
    const user = await db.user.create({ data: { email: `${id}@example.test` } });
    await db.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { enabled: true } });
    await db.$transaction((tx) => applyManualAdjustment(tx, {
      userId: user.id, adminActor: 'admin:test@example.test', points: '1000',
      reason: 'Prueba', idempotencyKey: randomUUID(), now: new Date(),
    }));
    const createOrder = (suffix: string) => db.order.create({
      data: {
        orderNumber: `${id}-${suffix}`, userId: user.id, email: user.email,
        fullName: 'Prueba', phone: '123', shippingAddress: 'Prueba', shippingPostalCode: '28001',
        shippingCity: 'Madrid', shippingLocality: 'Madrid', shippingProvince: 'Madrid', totalAmount: '121', items: [],
      },
    });
    const orders = await Promise.all([createOrder('1'), createOrder('2')]);
    const results = await Promise.allSettled(orders.map((order) => db.$transaction((tx) => reserveRedemption(tx, {
      userId: user.id, orderId: order.id, points: '700',
      eligibleSubtotalGross: '121', eligibleSubtotalNet: '100',
      paymentLimitGross: '120.99', taxRate: '0.21', now: new Date(),
    }))));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const reservations = await db.loyaltyRedemption.findMany({ where: { account: { userId: user.id } } });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].points.toString()).toBe('700');
  });
});
