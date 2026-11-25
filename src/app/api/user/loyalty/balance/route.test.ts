import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  auth: vi.fn(),
  transaction: vi.fn(),
  config: vi.fn(),
  account: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyLocalPreview: mocks.enabled }));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/loyalty/ledger', () => ({ getLocalAccount: mocks.account }));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: mocks.capture }));
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));

import { GET } from './route';

const request = () => new NextRequest('http://localhost/api/user/loyalty/balance');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.auth.mockResolvedValue({ user: { id: 'customer' } });
  mocks.config.mockResolvedValue({ enabled: true });
  mocks.transaction.mockImplementation((fn) => fn({ loyaltyProgramConfig: { findUniqueOrThrow: mocks.config } }));
  mocks.account.mockResolvedValue({
    balance: new Prisma.Decimal('1200.75'),
    reserved: new Prisma.Decimal('200'),
    config: { pointsPerEuro: new Prisma.Decimal('100') },
  });
});

describe('account loyalty balance', () => {
  it('only serves authenticated users in the local preview', async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await GET(request())).status).toBe(404);
    mocks.enabled.mockReturnValue(true);
    mocks.auth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns the authenticated user’s unreserved balance and its value without caching', async () => {
    const response = await GET(request());
    expect(await response.json()).toEqual({ points: '1000.75', value: '10.00' });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.account).toHaveBeenCalledWith(expect.anything(), 'customer', expect.any(Date));
  });

  it('does not present debt as spendable points', async () => {
    mocks.account.mockResolvedValue({
      balance: new Prisma.Decimal('-0.75'), reserved: new Prisma.Decimal(0),
      config: { pointsPerEuro: new Prisma.Decimal(100) },
    });
    expect(await (await GET(request())).json()).toEqual({ points: '0', value: '0.00' });
  });

  it('hides a disabled program and reports failures', async () => {
    mocks.config.mockResolvedValueOnce({ enabled: false });
    expect((await GET(request())).status).toBe(404);
    expect(mocks.account).not.toHaveBeenCalled();
    mocks.config.mockRejectedValueOnce(new Error('database unavailable'));
    expect((await GET(request())).status).toBe(500);
    expect(mocks.capture).toHaveBeenCalledOnce();
  });
});
