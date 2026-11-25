import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    loyaltyPurchase: { findUnique: vi.fn() },
    order: { findUniqueOrThrow: vi.fn() },
    loyaltyProgramConfig: { findUniqueOrThrow: vi.fn() },
    loyaltyOrderReward: { findUnique: vi.fn(), create: vi.fn() },
    loyaltyRedemption: { findUnique: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
    loyaltyPointsLot: { create: vi.fn() },
  },
  lockAccount: vi.fn(),
  ledgerBalance: vi.fn(),
  expireLots: vi.fn(),
  getQualifyingSpend: vi.fn(),
  settleRedemption: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.tx }));
vi.mock('./ledger', () => ({
  lockAccount: mocks.lockAccount,
  ledgerBalance: mocks.ledgerBalance,
  expireLots: mocks.expireLots,
}));
vi.mock('./spending', () => ({ getQualifyingSpend: mocks.getQualifyingSpend }));
vi.mock('./redemption', () => ({ settleRedemption: mocks.settleRedemption }));

import { db } from '@/lib/db';
import { finalizeLoyaltyPurchase } from './purchase';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.loyaltyPurchase.findUnique.mockResolvedValue({
    userId: 'customer',
    productGross: new Prisma.Decimal('144.89'),
    shippingGross: new Prisma.Decimal('5'),
    eligibleSpend: new Prisma.Decimal('119.74'),
  });
  mocks.tx.order.findUniqueOrThrow.mockResolvedValue({
    paymentStatus: 'PAID', paymentPaidAt: new Date('2026-11-25T12:00:00Z'), status: 'PROCESSING',
  });
  mocks.tx.loyaltyProgramConfig.findUniqueOrThrow.mockResolvedValue({
    baseRate: new Prisma.Decimal('1'), evaluationDays: 60, expirationMonths: 12,
    tiers: [
      { name: 'Principiante', threshold: '0', multiplier: '1' },
      { name: 'Experto', threshold: '1000', multiplier: '1.5' },
    ],
  });
  mocks.tx.loyaltyOrderReward.findUnique.mockResolvedValue(null);
  mocks.tx.loyaltyOrderReward.create.mockImplementation(({ data }) => ({ id: 'reward', ...data }));
  mocks.tx.loyaltyRedemption.findUnique.mockResolvedValue({ id: 'redemption', discountGross: new Prisma.Decimal('36') });
  mocks.tx.loyaltyTransaction.create.mockResolvedValue({ id: 'entry' });
  mocks.lockAccount.mockResolvedValue('account');
  mocks.ledgerBalance.mockResolvedValue(new Prisma.Decimal('0'));
  mocks.expireLots.mockResolvedValue(new Prisma.Decimal('0'));
  mocks.getQualifyingSpend.mockResolvedValue(new Prisma.Decimal('1000'));
});

describe('finalizeLoyaltyPurchase', () => {
  it('credits points on the order total before the points discount (149.89 paid + 36 redeemed at x1.5 → 278)', async () => {
    const reward = await finalizeLoyaltyPurchase(db, 'order');
    expect(mocks.settleRedemption).toHaveBeenCalled();
    expect(reward?.pointsEarned.toString()).toBe('278');
    expect(reward?.eligibleSpend.toString()).toBe('119.74');
    expect(mocks.tx.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ points: new Prisma.Decimal('278'), balanceAfter: new Prisma.Decimal('278') }),
    });
    expect(mocks.tx.loyaltyPointsLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ originalPoints: new Prisma.Decimal('278'), remainingPoints: new Prisma.Decimal('278') }),
    });
  });

  it('uses the paid total when no points were redeemed', async () => {
    mocks.tx.loyaltyRedemption.findUnique.mockResolvedValue(null);
    const reward = await finalizeLoyaltyPurchase(db, 'order');
    expect(mocks.settleRedemption).not.toHaveBeenCalled();
    expect(reward?.pointsEarned.toString()).toBe('224');
  });
});
