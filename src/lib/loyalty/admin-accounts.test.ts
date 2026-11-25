import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  ledgerBalance: vi.fn(),
  expire: vi.fn(),
  adjust: vi.fn(),
}));

vi.mock('./ledger', async (original) => ({
  ...(await original<typeof import('./ledger')>()),
  lockAccount: mocks.lock,
  ledgerBalance: mocks.ledgerBalance,
  expireLots: mocks.expire,
  applyManualAdjustment: mocks.adjust,
}));

import { LoyaltyBalanceConflictError, setLoyaltyBalance } from './admin-accounts';
import { LoyaltyOperationError } from './ledger';

const findUnique = vi.fn();
const tx = { loyaltyTransaction: { findUnique } } as unknown as Prisma.TransactionClient;
const input = {
  userId: 'user',
  adminActor: 'admin:a@example.test',
  targetBalance: '150',
  expectedBalance: '91.74',
  idempotencyKey: 'b6dd3295-3094-4d88-beb8-492f0e6f4a6f',
  now: new Date('2026-11-24T12:00:00Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lock.mockResolvedValue('account');
  mocks.ledgerBalance.mockResolvedValue(new Prisma.Decimal('91.74'));
  mocks.expire.mockImplementation((_tx, _id, balance) => Promise.resolve(balance));
  findUnique.mockResolvedValue(null);
  mocks.adjust.mockImplementation((_tx, adj) => Promise.resolve({
    balanceAfter: new Prisma.Decimal('91.74').plus(adj.points),
  }));
});

describe('setLoyaltyBalance', () => {
  it('records the difference between the current and the requested balance as a manual adjustment', async () => {
    const result = await setLoyaltyBalance(tx, input);
    expect(mocks.adjust).toHaveBeenCalledWith(tx, expect.objectContaining({ points: '58.26', adminActor: input.adminActor }));
    expect(result.balance.toString()).toBe('150');
  });

  it('records negative differences when lowering the balance', async () => {
    await setLoyaltyBalance(tx, { ...input, targetBalance: '0' });
    expect(mocks.adjust).toHaveBeenCalledWith(tx, expect.objectContaining({ points: '-91.74' }));
  });

  it('rejects the update when the balance changed since the administrator loaded it', async () => {
    mocks.ledgerBalance.mockResolvedValue(new Prisma.Decimal('200'));
    await expect(setLoyaltyBalance(tx, input)).rejects.toBeInstanceOf(LoyaltyBalanceConflictError);
    expect(mocks.adjust).not.toHaveBeenCalled();
  });

  it('returns the stored result when the same request is retried', async () => {
    findUnique.mockResolvedValue({ accountId: 'account', balanceAfter: new Prisma.Decimal('150') });
    const result = await setLoyaltyBalance(tx, input);
    expect(result.balance.toString()).toBe('150');
    expect(mocks.adjust).not.toHaveBeenCalled();
  });

  it('rejects non-integer or negative targets', async () => {
    for (const targetBalance of ['-1', '1.5', 'abc', '']) {
      await expect(setLoyaltyBalance(tx, { ...input, targetBalance })).rejects.toBeInstanceOf(LoyaltyOperationError);
    }
    expect(mocks.lock).not.toHaveBeenCalled();
  });
});
