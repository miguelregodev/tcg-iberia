import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { applyManualAdjustment, getLocalAccount, LoyaltyOperationError } from './ledger';
import { releaseRedemption, reserveRedemption, settleRedemption } from './redemption';
import { finalizeLoyaltyPurchase } from './purchase';
import { applyLoyaltyBackfillForUser, LoyaltyBackfillAlreadyAppliedError } from './backfill';

const enabled = process.env.LOYALTY_INTEGRATION_TEST === '1';

describe.skipIf(!enabled)('local loyalty ledger integration', () => {
  it('records idempotent adjustments, spends oldest lots, and expires the remainder', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    const rollback = new Error('test rollback');
    try {
      await db.$transaction(async (tx) => {
        await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { enabled: true, expirationMonths: 12 } });
        const id = randomUUID();
        const customer = await tx.user.create({ data: { email: `${id}-customer@example.test` } });
        const first = {
          userId: customer.id,
          adminActor: 'admin:test@example.test',
          points: '1000',
          reason: 'Prueba',
          idempotencyKey: randomUUID(),
          now: new Date('2025-01-01T10:00:00Z'),
        };
        const created = await applyManualAdjustment(tx, first);
        expect(created.adminActor).toBe(first.adminActor);
        expect((await applyManualAdjustment(tx, first)).id).toBe(created.id);
        await applyManualAdjustment(tx, { ...first, points: '-250', idempotencyKey: randomUUID() });
        await applyManualAdjustment(tx, {
          ...first,
          points: '50',
          idempotencyKey: randomUUID(),
          now: new Date('2026-01-02T10:00:00Z'),
        });
        const result = await getLocalAccount(tx, customer.id, new Date('2026-01-02T10:00:00Z'));
        expect(result.balance.toString()).toBe('50');
        expect(result.transactions.map((entry) => entry.points.toString())).toEqual(['50', '-750', '-250', '1000']);
        await expect(applyManualAdjustment(tx, {
          ...first,
          points: '-51',
          idempotencyKey: randomUUID(),
          now: new Date('2026-01-02T10:00:00Z'),
        })).rejects.toBeInstanceOf(LoyaltyOperationError);
        throw rollback;
      }, { timeout: 20_000 });
      throw new Error('Test transaction did not roll back');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it('reserves points once, settles a paid order and expires released points correctly', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    const rollback = new Error('test rollback');
    try {
      await db.$transaction(async (tx) => {
        await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { enabled: true, expirationMonths: 12 } });
        const id = randomUUID();
        const customer = await tx.user.create({ data: { email: `${id}@example.test` } });
        const now = new Date('2025-01-01T10:00:00Z');
        await applyManualAdjustment(tx, {
          userId: customer.id,
          adminActor: 'admin:test@example.test',
          points: '1000',
          reason: 'Prueba',
          idempotencyKey: randomUUID(),
          now,
        });
        const createOrder = (suffix: string) => tx.order.create({
          data: {
            orderNumber: `${id}-${suffix}`, userId: customer.id, email: customer.email,
            fullName: 'Prueba', phone: '123', shippingAddress: 'Prueba',
            shippingPostalCode: '28001', shippingCity: 'Madrid', shippingLocality: 'Madrid',
            shippingProvince: 'Madrid', totalAmount: '1000', items: [],
          },
        });
        const first = await createOrder('1');
        const second = await createOrder('2');
        const third = await createOrder('3');
        const input = {
          userId: customer.id, orderId: first.id, points: '400',
          eligibleSubtotalGross: '1000', eligibleSubtotalNet: '826.45',
          paymentLimitGross: '999.99', taxRate: '0.21', now,
        };
        const reserved = await reserveRedemption(tx, input);
        expect(reserved.discountGross.toString()).toBe('4');
        await expect(reserveRedemption(tx, { ...input, orderId: second.id, points: '700' }))
          .rejects.toBeInstanceOf(LoyaltyOperationError);
        await expect(settleRedemption(tx, first.id, now)).rejects.toBeInstanceOf(LoyaltyOperationError);
        await tx.order.update({ where: { id: first.id }, data: { paymentStatus: 'PAID' } });
        await settleRedemption(tx, first.id, now);
        await settleRedemption(tx, first.id, now);
        const secondReservation = await reserveRedemption(tx, { ...input, orderId: second.id, points: '200' });
        expect(secondReservation.points.toString()).toBe('200');
        await expect(releaseRedemption(tx, second.id, now)).rejects.toBeInstanceOf(LoyaltyOperationError);
        await tx.order.update({ where: { id: second.id }, data: { paymentStatus: 'PAYMENT_FAILED' } });
        await releaseRedemption(tx, second.id, now);
        await releaseRedemption(tx, second.id, now);
        expect((await getLocalAccount(tx, customer.id, now)).balance.toString()).toBe('600');
        await reserveRedemption(tx, { ...input, orderId: third.id, points: '200' });
        await tx.order.update({ where: { id: third.id }, data: { paymentStatus: 'PAYMENT_FAILED' } });
        const afterExpiration = new Date('2026-01-02T10:00:00Z');
        await releaseRedemption(tx, third.id, afterExpiration);
        await releaseRedemption(tx, third.id, afterExpiration);
        const account = await getLocalAccount(tx, customer.id, afterExpiration);
        expect(account.balance.toString()).toBe('0');
        expect(account.transactions.map((entry) => entry.points.toString())).toEqual(['-200', '-400', '-400', '1000']);
        throw rollback;
      }, { timeout: 20_000 });
      throw new Error('Test transaction did not roll back');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it('settles once and uses the tier before each confirmed purchase', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    const rollback = new Error('test rollback');
    try {
      await db.$transaction(async (tx) => {
        await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { enabled: true, baseRate: 1, evaluationDays: 60, expirationMonths: 12 } });
        const id = randomUUID();
        const customer = await tx.user.create({ data: { email: `${id}@example.test` } });
        const now = new Date('2025-01-01T10:00:00Z');
        await applyManualAdjustment(tx, {
          userId: customer.id, adminActor: 'admin:test@example.test', points: '1000',
          reason: 'Prueba', idempotencyKey: randomUUID(), now,
        });
        const createOrder = (suffix: string) => tx.order.create({
          data: {
            orderNumber: `${id}-${suffix}`, userId: customer.id, email: customer.email,
            fullName: 'Prueba', phone: '123', shippingAddress: 'Prueba', shippingPostalCode: '28001',
            shippingCity: 'Madrid', shippingLocality: 'Madrid', shippingProvince: 'Madrid', totalAmount: '605', items: [],
          },
        });
        const first = await createOrder('1');
        await reserveRedemption(tx, {
          userId: customer.id, orderId: first.id, points: '100',
          eligibleSubtotalGross: '606', eligibleSubtotalNet: '500.83',
          paymentLimitGross: '605.99', taxRate: '0.21', now,
        });
        await tx.loyaltyPurchase.create({
          data: { orderId: first.id, userId: customer.id, productGross: '605', eligibleSpend: '500', shippingGross: '0' },
        });
        await tx.order.update({ where: { id: first.id }, data: { paymentStatus: 'PAID', paymentPaidAt: now } });
        const reward = await finalizeLoyaltyPurchase(tx, first.id);
        expect(reward?.pointsEarned.toString()).toBe('606');
        expect(reward?.tierName).toBe('Principiante');
        expect((await finalizeLoyaltyPurchase(tx, first.id))?.id).toBe(reward?.id);

        const second = await createOrder('2');
        await tx.loyaltyPurchase.create({
          data: { orderId: second.id, userId: customer.id, productGross: '121', eligibleSpend: '100', shippingGross: '0' },
        });
        await tx.order.update({ where: { id: second.id }, data: { paymentStatus: 'PAID', paymentPaidAt: new Date('2025-01-02T10:00:00Z') } });
        const secondReward = await finalizeLoyaltyPurchase(tx, second.id);
        expect(secondReward?.tierName).toBe('Avanzado');
        expect(secondReward?.pointsEarned.toString()).toBe('151');
        const account = await getLocalAccount(tx, customer.id, new Date('2025-01-02T10:00:00Z'));
        expect(account.balance.toString()).toBe('1657');
        expect(account.transactions.map((entry) => entry.points.toString())).toEqual(['151', '606', '-100', '1000']);
        throw rollback;
      }, { timeout: 20_000 });
      throw new Error('Test transaction did not roll back');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it('counts paid orders made before the program in the rolling tier window', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    const rollback = new Error('test rollback');
    try {
      await db.$transaction(async (tx) => {
        await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { enabled: true, baseRate: 1, evaluationDays: 60, expirationMonths: 12 } });
        const id = randomUUID();
        const customer = await tx.user.create({ data: { email: `${id}@example.test` } });
        const now = new Date('2025-03-01T10:00:00Z');
        const createOrder = (suffix: string, data: Record<string, unknown>) => tx.order.create({
          data: {
            orderNumber: `${id}-${suffix}`, userId: customer.id, email: customer.email,
            fullName: 'Prueba', phone: '123', shippingAddress: 'Prueba', shippingPostalCode: '28001',
            shippingCity: 'Madrid', shippingLocality: 'Madrid', shippingProvince: 'Madrid',
            totalAmount: '610.99', items: [{ id: 'p', name: 'P', price: 605, quantity: 1 }],
            paymentStatus: 'PAID', ...data,
          },
        });
        await createOrder('legacy', { paymentPaidAt: new Date('2025-02-10T10:00:00Z') });
        await createOrder('too-old', { paymentPaidAt: new Date('2024-12-01T10:00:00Z') });
        await createOrder('cancelled', { paymentPaidAt: new Date('2025-02-11T10:00:00Z'), status: 'CANCELLED' });

        const before = await getLocalAccount(tx, customer.id, now);
        expect(before.spending.toString()).toBe('500');

        const order = await createOrder('new', { paymentStatus: 'PENDING_PAYMENT', totalAmount: '121', items: [] });
        await tx.loyaltyPurchase.create({
          data: { orderId: order.id, userId: customer.id, productGross: '121', eligibleSpend: '100', shippingGross: '0' },
        });
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', paymentPaidAt: now } });
        const reward = await finalizeLoyaltyPurchase(tx, order.id);
        expect(reward?.tierName).toBe('Avanzado');
        expect(reward?.pointsEarned.toString()).toBe('151');
        expect((await getLocalAccount(tx, customer.id, now)).spending.toString()).toBe('600');
        throw rollback;
      }, { timeout: 20_000 });
      throw new Error('Test transaction did not roll back');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it('migrates the last 60 days of a customer once, with the historical tier and without double counting spend', async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    expect(['localhost', '127.0.0.1', '::1', '[::1]']).toContain(url.hostname);
    const rollback = new Error('test rollback');
    try {
      await db.$transaction(async (tx) => {
        await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { baseRate: 1, evaluationDays: 60, expirationMonths: 12 } });
        const id = randomUUID();
        const customer = await tx.user.create({ data: { email: `${id}@example.test` } });
        const now = new Date('2025-03-01T10:00:00Z');
        const createOrder = (suffix: string, paidAt: string, gross: string) => tx.order.create({
          data: {
            orderNumber: `${id}-${suffix}`, userId: customer.id, email: customer.email,
            fullName: 'Prueba', phone: '123', shippingAddress: 'Prueba', shippingPostalCode: '28001',
            shippingCity: 'Madrid', shippingLocality: 'Madrid', shippingProvince: 'Madrid',
            totalAmount: gross, paymentAmount: gross, paymentCurrency: '978', paymentStatus: 'PAID',
            paymentPaidAt: new Date(paidAt), items: [{ id: 'p', name: 'P', price: Number(gross), quantity: 1 }],
          },
        });
        await createOrder('first', '2025-02-01T10:00:00Z', '605');
        await createOrder('second', '2025-02-10T10:00:00Z', '121');
        const spendingBefore = (await getLocalAccount(tx, customer.id, now)).spending.toString();

        const result = await applyLoyaltyBackfillForUser(tx, { userId: customer.id, adminActor: 'admin:test', now });
        expect(result).toMatchObject({ creditedOrders: 2, points: '756', balance: '756.00', review: [] });
        const account = await getLocalAccount(tx, customer.id, now);
        expect(account.spending.toString()).toBe(spendingBefore);
        expect(account.transactions.map((entry) => entry.points.toString())).toEqual(['151', '605']);
        await expect(applyLoyaltyBackfillForUser(tx, { userId: customer.id, adminActor: 'admin:test', now }))
          .rejects.toBeInstanceOf(LoyaltyBackfillAlreadyAppliedError);
        expect((await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId: customer.id } })).historicalBackfillAt).toEqual(now);
        throw rollback;
      }, { timeout: 20_000 });
      throw new Error('Test transaction did not roll back');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
