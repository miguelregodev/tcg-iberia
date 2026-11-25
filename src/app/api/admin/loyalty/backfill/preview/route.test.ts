import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  local: vi.fn(), admin: vi.fn(), transaction: vi.fn(), readOnly: vi.fn(), preview: vi.fn(), capture: vi.fn(),
}));
vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyEnabled: mocks.local }));
vi.mock('@/lib/loyalty/admin', () => ({ getLoyaltyAdministrator: mocks.admin }));
vi.mock('@/lib/loyalty/backfill', () => ({ previewLoyaltyBackfill: mocks.preview }));
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: mocks.capture }));

import { POST } from './route';

const activationAt = '2026-09-01T00:00:00Z';
const request = (body: unknown = { activationAt }) => new NextRequest('http://localhost/api/admin/loyalty/backfill/preview', {
  method: 'POST', body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.local.mockReturnValue(true);
  mocks.admin.mockReturnValue('admin:example.test');
  mocks.transaction.mockImplementation((fn) => fn({ $executeRaw: mocks.readOnly }));
  mocks.preview.mockResolvedValue({ dryRun: true, entries: [], summary: { totalPoints: '0' } });
});

describe('loyalty backfill simulation endpoint', () => {
  it('requires local preview and an authenticated administrator before reading any data', async () => {
    mocks.local.mockReturnValue(false);
    expect((await POST(request())).status).toBe(404);
    mocks.local.mockReturnValue(true);
    mocks.admin.mockReturnValue(null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([null, {}, { activationAt: '2026-09-01' }, { activationAt: 'invalid' }, { activationAt: '2999-01-01T00:00:00Z' }])(
    'rejects missing, invalid, ambiguous or future activation times: %j',
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it('uses a read-only repeatable snapshot and returns a non-cacheable simulation', async () => {
    mocks.preview.mockImplementation(async () => {
      expect(mocks.readOnly).toHaveBeenCalledWith(expect.objectContaining({ sql: 'SET TRANSACTION READ ONLY' }));
      return { dryRun: true, entries: [], summary: { totalPoints: '0' } };
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ dryRun: true, summary: { totalPoints: '0' } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'RepeatableRead' }));
    expect(mocks.preview).toHaveBeenCalledWith(expect.anything(), new Date(activationAt));
  });

  it('logs database failures and never returns a success-shaped empty report', async () => {
    const error = new Error('Database failure');
    mocks.preview.mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(mocks.capture).toHaveBeenCalledWith(expect.objectContaining({ error }));
    expect(await response.json()).toHaveProperty('error');
  });
});
