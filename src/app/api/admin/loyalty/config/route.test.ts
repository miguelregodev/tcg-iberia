import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  queryRaw: vi.fn(),
  configFind: vi.fn(),
  configUpdate: vi.fn(),
  tiersDelete: vi.fn(),
  tiersCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  preview: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({ isAdminAuthenticated: mocks.isAdmin }));
vi.mock('@/lib/b2b/admin-auth', () => ({ getAdminActor: () => 'admin:real@example.test' }));
vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyEnabled: mocks.preview, isLoyaltyLocalPreview: () => false, isLoyaltyCheckoutEnabled: () => false }));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    loyaltyProgramConfig: { findUniqueOrThrow: mocks.configFind },
    $transaction: mocks.transaction,
  },
}));

import { GET, PUT } from './route';

const payload = {
  enabled: false,
  reason: 'Cambio de política',
  actorId: 'attacker',
  baseRate: '1',
  pointsPerEuro: '100',
  minimumRedemption: '100',
  redemptionIncrement: '100',
  maxDiscountPercent: '20',
  evaluationDays: 60,
  expirationMonths: 12,
  tiers: [{ name: 'Principiante', threshold: '0', multiplier: '1', description: '', color: '#123456', icon: '', benefits: [] }],
};
const record = {
  ...payload,
  baseRate: new Prisma.Decimal(1),
  pointsPerEuro: new Prisma.Decimal(100),
  minimumRedemption: new Prisma.Decimal(100),
  redemptionIncrement: new Prisma.Decimal(100),
  maxDiscountPercent: new Prisma.Decimal(20),
  tiers: [{ ...payload.tiers[0], threshold: new Prisma.Decimal(0), multiplier: new Prisma.Decimal(1) }],
};

function request(method: 'GET' | 'PUT', body?: unknown) {
  return new NextRequest('https://shop.example.com/api/admin/loyalty/config', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAdmin.mockReturnValue(true);
  mocks.preview.mockReturnValue(false);
  mocks.configFind.mockResolvedValue(record);
  mocks.transaction.mockImplementation(async (callback) => callback({
    $queryRaw: mocks.queryRaw,
    loyaltyProgramConfig: { findUniqueOrThrow: mocks.configFind, update: mocks.configUpdate },
    loyaltyTier: { deleteMany: mocks.tiersDelete, createMany: mocks.tiersCreate },
    loyaltyAdminAction: { create: mocks.auditCreate },
  }));
});

describe('admin loyalty configuration', () => {
  it('requires the backoffice session without a separate customer account', async () => {
    mocks.isAdmin.mockReturnValue(false);
    expect((await GET(request('GET'))).status).toBe(403);
    expect((await PUT(request('PUT', payload))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.isAdmin.mockReturnValue(true);
    expect((await GET(request('GET'))).status).toBe(200);
  });

  it('refuses activation and invalid configuration', async () => {
    expect((await PUT(request('PUT', { ...payload, enabled: true }))).status).toBe(400);
    expect((await PUT(request('PUT', { ...payload, baseRate: '0' }))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('records the authenticated administrator, not the submitted actor', async () => {
    expect((await PUT(request('PUT', payload))).status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ adminActor: 'admin:real@example.test', action: 'CONFIG_UPDATE', reason: payload.reason }),
    }));
  });

  it('allows activation only when the module is available', async () => {
    mocks.preview.mockReturnValue(true);
    expect((await PUT(request('PUT', { ...payload, enabled: true }))).status).toBe(200);
    expect(mocks.configUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ enabled: true }),
    }));
  });

});
