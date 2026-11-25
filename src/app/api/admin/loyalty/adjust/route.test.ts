import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  admin: vi.fn(),
  userFind: vi.fn(),
  transaction: vi.fn(),
  adjust: vi.fn(),
}));

vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyEnabled: mocks.preview }));
vi.mock('@/lib/loyalty/admin', () => ({ getLoyaltyAdministrator: mocks.admin }));
vi.mock('@/lib/loyalty/ledger', () => ({
  applyManualAdjustment: mocks.adjust,
  LoyaltyOperationError: class LoyaltyOperationError extends Error {},
}));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: mocks.userFind }, $transaction: mocks.transaction },
}));

import { POST } from './route';

const body = {
  email: 'customer@example.test',
  points: '100',
  reason: 'Prueba',
  idempotencyKey: 'b6dd3295-3094-4d88-beb8-492f0e6f4a6f',
  actorId: 'forged-admin',
};
const request = () => new NextRequest('http://localhost/api/admin/loyalty/adjust', {
  method: 'POST',
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.preview.mockReturnValue(true);
  mocks.admin.mockReturnValue('admin:real@example.test');
  mocks.userFind.mockResolvedValue({ id: 'customer' });
  mocks.transaction.mockImplementation((fn) => fn({}));
  mocks.adjust.mockResolvedValue({ points: { toString: () => '100' }, balanceAfter: { toString: () => '100' } });
});

describe('local adjustment endpoint', () => {
  it('rejects requests outside the preview or without an administrator', async () => {
    mocks.preview.mockReturnValue(false);
    expect((await POST(request())).status).toBe(404);
    mocks.preview.mockReturnValue(true);
    mocks.admin.mockReturnValue(null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('uses the authenticated actor and the customer resolved by the server', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.adjust).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      adminActor: 'admin:real@example.test',
      userId: 'customer',
      points: '100',
    }));
  });
});
