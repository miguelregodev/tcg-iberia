import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ local: vi.fn(), admin: vi.fn(), transaction: vi.fn(), apply: vi.fn(), capture: vi.fn() }));
vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyEnabled: mocks.local }));
vi.mock('@/lib/loyalty/admin', () => ({ getLoyaltyAdministrator: mocks.admin }));
vi.mock('@/lib/loyalty/backfill', async (original) => ({
  ...(await original<typeof import('@/lib/loyalty/backfill')>()),
  applyLoyaltyBackfillForUser: mocks.apply,
}));
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: mocks.capture }));

import { LoyaltyBackfillAlreadyAppliedError } from '@/lib/loyalty/backfill';
import { POST } from './route';

const call = () => POST(
  new NextRequest('http://localhost/api/admin/loyalty/accounts/customer/backfill', { method: 'POST' }),
  { params: Promise.resolve({ userId: 'customer' }) },
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.local.mockReturnValue(true);
  mocks.admin.mockReturnValue('admin:backoffice');
  mocks.transaction.mockImplementation((fn) => fn('tx'));
});

describe('customer loyalty backfill endpoint', () => {
  it('requires local preview and an administrator before writing', async () => {
    mocks.local.mockReturnValue(false);
    expect((await call()).status).toBe(404);
    mocks.local.mockReturnValue(true);
    mocks.admin.mockReturnValue(null);
    expect((await call()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('migrates the customer with the administrator as actor', async () => {
    mocks.apply.mockResolvedValue({ userId: 'customer', points: '151' });
    const response = await call();
    expect(response.status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith('tx', expect.objectContaining({ userId: 'customer', adminActor: 'admin:backoffice' }));
    expect(await response.json()).toMatchObject({ points: '151' });
  });

  it('returns 409 when the customer was already migrated', async () => {
    mocks.apply.mockRejectedValue(new LoyaltyBackfillAlreadyAppliedError('Ya migrado.'));
    expect((await call()).status).toBe(409);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});