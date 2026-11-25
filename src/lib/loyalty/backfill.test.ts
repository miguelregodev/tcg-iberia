import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ledger = vi.hoisted(() => ({ lock: vi.fn(), balance: vi.fn(), expire: vi.fn() }));
vi.mock('./ledger', async (original) => ({
  ...(await original<typeof import('./ledger')>()),
  lockAccount: ledger.lock,
  ledgerBalance: ledger.balance,
  expireLots: ledger.expire,
}));

import { applyLoyaltyBackfillForUser, buildLoyaltyBackfillPreview, LoyaltyBackfillAlreadyAppliedError } from './backfill';
import { LoyaltyOperationError } from './ledger';

type HistoricalOrder = Parameters<typeof buildLoyaltyBackfillPreview>[0][number];
const activationAt = new Date('2026-11-25T00:00:00Z');
const config = {
  baseRate: new Prisma.Decimal(1),
  evaluationDays: 60,
  tiers: [
    { name: 'Principiante', threshold: '0', multiplier: '1' },
    { name: 'Avanzado', threshold: '500', multiplier: '1.25' },
    { name: 'Experto', threshold: '1000', multiplier: '1.5' },
  ],
};

function order(id: string, paidAt: string, gross = '121', overrides: Partial<HistoricalOrder> = {}): HistoricalOrder {
  return {
    id, orderNumber: id, userId: 'customer',
    createdAt: new Date(paidAt), paymentPaidAt: new Date(paidAt),
    paymentStatus: 'PAID', status: 'COMPLETED', paymentCurrency: 'EUR',
    paymentAmount: new Prisma.Decimal(gross), totalAmount: new Prisma.Decimal(gross),
    items: [{ price: Number(gross), quantity: 1 }],
    partyParticipation: null, loyaltyPurchase: null, loyaltyReward: null,
    loyaltyTransactions: [], _count: { loyaltyRefunds: 0 },
    ...overrides,
  };
}

describe('historical loyalty preview', () => {
  it('uses older orders to reconstruct the pre-purchase tier without rewarding them outside the 60-day cutoff', () => {
    const report = buildLoyaltyBackfillPreview([
      order('later', '2026-11-24T12:00:00Z'),
      order('first', '2026-10-01T12:00:00Z'),
      order('older', '2026-09-01T12:00:00Z', '605'),
    ], config, activationAt);
    expect(report.dryRun).toBe(true);
    expect(report.summary).toMatchObject({ eligibleOrders: 2, totalPoints: '272', reviewOrders: 0 });
    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ orderId: 'first', tier: 'Avanzado', priorSpend: '500.00', points: '151' }),
      expect.objectContaining({ orderId: 'later', tier: 'Principiante', priorSpend: '100.00', points: '121' }),
    ]));
  });

  it('does not count the current purchase towards its own multiplier', () => {
    const report = buildLoyaltyBackfillPreview([
      order('crossing', '2026-10-01T12:00:00Z', '605'),
      order('next', '2026-10-02T12:00:00Z'),
    ], config, activationAt);
    expect(report.entries).toMatchObject([
      { orderId: 'crossing', tier: 'Principiante', points: '605' },
      { orderId: 'next', tier: 'Avanzado', points: '151' },
    ]);
  });

  it('earns whole points on the full paid total, including VAT and shipping', () => {
    const report = buildLoyaltyBackfillPreview([
      order('older', '2026-09-01T12:00:00Z', '1210'),
      order('purchase', '2026-10-01T12:00:00Z', '149.89', { items: [{ price: 144.89, quantity: 1 }] }),
    ], config, activationAt);
    expect(report.entries).toMatchObject([{ tier: 'Experto', multiplier: '1.5', points: '224' }]);
  });

  it('includes the lower cutoff and excludes orders paid at or after activation', () => {
    const report = buildLoyaltyBackfillPreview([
      order('before', '2026-09-25T23:59:59Z'),
      order('start', '2026-09-26T00:00:00Z'),
      order('activation', '2026-11-25T00:00:00Z'),
      order('future', '2026-11-26T00:00:00Z'),
    ], config, activationAt);
    expect(report.entries.map((entry) => entry.orderId)).toEqual(['start']);
  });

  it('never proposes a second credit for an existing reward or ledger entry', () => {
    const reward = { eligibleSpend: new Prisma.Decimal('100'), refundedSpend: new Prisma.Decimal(0) };
    const report = buildLoyaltyBackfillPreview([
      order('rewarded', '2026-10-01T12:00:00Z', '121', { loyaltyReward: reward }),
      order('ledger', '2026-10-02T12:00:00Z', '121', { loyaltyTransactions: [{ id: 'existing' }] }),
    ], config, activationAt);
    expect(report.summary).toMatchObject({ eligibleOrders: 0, skippedOrders: 2, totalPoints: '0' });
  });

  it('excludes cancelled, returned and unpaid orders and party participations', () => {
    const report = buildLoyaltyBackfillPreview([
      order('cancelled', '2026-10-01T12:00:00Z', '121', { status: 'CANCELLED' }),
      order('returned', '2026-10-01T12:00:00Z', '121', { status: 'DEVUELTO' }),
      order('unpaid', '2026-10-01T12:00:00Z', '121', { paymentStatus: 'PENDING_PAYMENT' }),
      order('party', '2026-10-01T12:00:00Z', '121', { partyParticipation: { id: 'party' } }),
    ], config, activationAt);
    expect(report.summary).toMatchObject({ eligibleOrders: 0, skippedOrders: 4, totalPoints: '0' });
  });

  it.each([
    { userId: null },
    { paymentAmount: null },
    { paymentAmount: new Prisma.Decimal('120') },
    { paymentCurrency: 'USD' },
    { items: [{ price: '121', quantity: 1 }] },
    { items: [{ price: 121, quantity: 1, discountPercentage: 101 }] },
    { _count: { loyaltyRefunds: 1 } },
    { loyaltyPurchase: { eligibleSpend: new Prisma.Decimal('100') } },
  ] satisfies Partial<HistoricalOrder>[])('flags ambiguous ownership, payment, products or rewards for review: %j', (overrides) => {
    const report = buildLoyaltyBackfillPreview([
      order('ambiguous', '2026-10-01T12:00:00Z', '121', overrides),
    ], config, activationAt);
    expect(report.summary).toMatchObject({ eligibleOrders: 0, reviewOrders: 1, totalPoints: '0' });
    expect(report.entries[0].reason).toBeTruthy();
  });

  it('flags missing payment dates and blocks only the affected customer historical tiers', () => {
    const report = buildLoyaltyBackfillPreview([
      order('undated', '2026-08-01T12:00:00Z', '605', { paymentPaidAt: null }),
      order('affected', '2026-10-01T12:00:00Z'),
      order('other', '2026-10-01T12:00:00Z', '121', { userId: 'other' }),
    ], config, activationAt);
    expect(report.summary).toMatchObject({ eligibleOrders: 1, reviewOrders: 2, totalPoints: '121' });
    expect(report.entries[1]).toMatchObject({ status: 'review', reason: expect.stringContaining('undated') });
  });

  it('does not guess the purchase order of identical payment timestamps', () => {
    const report = buildLoyaltyBackfillPreview([
      order('one', '2026-10-01T12:00:00Z', '605'),
      order('two', '2026-10-01T12:00:00Z'),
    ], config, activationAt);
    expect(report.summary).toMatchObject({ eligibleOrders: 0, reviewOrders: 2, totalPoints: '0' });
  });

  it('does not guess tiers affected by an earlier refund or cancellation with no historical timestamp', () => {
    const report = buildLoyaltyBackfillPreview([
      order('returned', '2026-09-01T12:00:00Z', '605', { status: 'DEVUELTO' }),
      order('affected', '2026-10-01T12:00:00Z'),
    ], config, activationAt);
    expect(report.entries).toMatchObject([{ status: 'review', reason: expect.stringContaining('returned') }]);
  });
});

describe('applyLoyaltyBackfillForUser', () => {
  const now = new Date('2026-11-25T00:00:00Z');
  const fakeTx = () => {
    let transactionId = 0;
    return {
      $queryRaw: vi.fn().mockResolvedValue([]),
      loyaltyProgramConfig: { findUniqueOrThrow: vi.fn().mockResolvedValue({ ...config, expirationMonths: 12 }) },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'customer' }) },
      loyaltyAccount: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ historicalBackfillAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      loyaltyRedemption: { count: vi.fn().mockResolvedValue(0) },
      order: { findMany: vi.fn().mockResolvedValue([]) },
      loyaltyOrderReward: { create: vi.fn().mockResolvedValue({}) },
      loyaltyTransaction: { create: vi.fn().mockImplementation(() => Promise.resolve({ id: `tx${++transactionId}` })) },
      loyaltyPointsLot: { create: vi.fn().mockResolvedValue({}) },
      loyaltyAdminAction: { create: vi.fn().mockResolvedValue({}) },
    };
  };
  const run = (tx: ReturnType<typeof fakeTx>) => applyLoyaltyBackfillForUser(
    tx as unknown as Prisma.TransactionClient,
    { userId: 'customer', adminActor: 'admin:backoffice', now },
  );

  beforeEach(() => {
    vi.resetAllMocks();
    ledger.lock.mockResolvedValue('account');
    ledger.balance.mockResolvedValue(new Prisma.Decimal(50));
    ledger.expire.mockImplementation((_tx, _id, balance) => Promise.resolve(balance));
  });

  it('credits each eligible order with its historical tier, reports review orders and marks the account', async () => {
    const tx = fakeTx();
    tx.order.findMany.mockResolvedValue([
      order('older', '2026-09-01T12:00:00Z', '605'),
      order('first', '2026-10-01T12:00:00Z'),
      order('second', '2026-10-05T12:00:00Z', '121', { paymentCurrency: 'USD' }),
    ]);
    const result = await run(tx);

    expect(tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'customer' }),
    }));
    expect(tx.loyaltyOrderReward.create).toHaveBeenCalledTimes(1);
    expect(tx.loyaltyOrderReward.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orderId: 'first', accountId: 'account', tierName: 'Avanzado', paidAt: new Date('2026-10-01T12:00:00Z'),
    }) });
    const reward = tx.loyaltyOrderReward.create.mock.calls[0][0].data;
    expect(reward.eligibleSpend.toString()).toBe('100');
    expect(reward.pointsEarned.toString()).toBe('151');
    const entry = tx.loyaltyTransaction.create.mock.calls[0][0].data;
    expect(entry).toMatchObject({ type: 'PURCHASE_REWARD', orderId: 'first', idempotencyKey: 'backfill:first' });
    expect(entry.balanceAfter.toString()).toBe('201');
    expect(entry.expiresAt).toEqual(expect.any(Date));
    expect(tx.loyaltyPointsLot.create).toHaveBeenCalledWith({ data: expect.objectContaining({ transactionId: 'tx1' }) });
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
    expect(tx.loyaltyAdminAction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'HISTORICAL_BACKFILL' }) });
    expect(result).toMatchObject({ migratedAt: null, creditedOrders: 1, points: '151', balance: '201.00', review: [{ orderNumber: 'second' }] });
  });

  it('marks the account as migrated once no orders are pending review', async () => {
    const tx = fakeTx();
    tx.order.findMany.mockResolvedValue([order('redsys', '2026-10-01T12:00:00Z', '121', { paymentCurrency: '978' })]);
    const result = await run(tx);
    expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { id: 'account' }, data: { historicalBackfillAt: now, historicalBackfillBy: 'admin:backoffice' },
    });
    expect(result).toMatchObject({ migratedAt: now.toISOString(), creditedOrders: 1, points: '121', review: [] });
  });

  it('refuses to run twice for the same customer', async () => {
    const tx = fakeTx();
    tx.loyaltyAccount.findUniqueOrThrow.mockResolvedValue({ historicalBackfillAt: new Date('2026-11-20T00:00:00Z') });
    await expect(run(tx)).rejects.toBeInstanceOf(LoyaltyBackfillAlreadyAppliedError);
    expect(tx.order.findMany).not.toHaveBeenCalled();
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
  });

  it('does not credit orders that already have a reward', async () => {
    const tx = fakeTx();
    tx.order.findMany.mockResolvedValue([order('rewarded', '2026-10-01T12:00:00Z', '121', {
      loyaltyReward: { eligibleSpend: new Prisma.Decimal('100'), refundedSpend: new Prisma.Decimal(0) },
    })]);
    const result = await run(tx);
    expect(tx.loyaltyOrderReward.create).not.toHaveBeenCalled();
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ creditedOrders: 0, points: '0' });
    expect(tx.loyaltyAccount.update).toHaveBeenCalled();
  });

  it('rejects accounts with pending redemptions', async () => {
    const tx = fakeTx();
    tx.loyaltyRedemption.count.mockResolvedValue(1);
    await expect(run(tx)).rejects.toBeInstanceOf(LoyaltyOperationError);
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });
});
