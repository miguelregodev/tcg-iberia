import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPublicParty: vi.fn(),
  findFirst: vi.fn(),
  captureServerError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/parties/public', () => ({ getPublicParty: mocks.getPublicParty }));
vi.mock('@/lib/db', () => ({
  db: { partyParticipation: { findFirst: mocks.findFirst } },
}));
vi.mock('@/lib/observability/sentry', () => ({
  captureServerError: mocks.captureServerError,
}));

import { GET } from './route';

describe('Party detail participation eligibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getPublicParty.mockResolvedValue([{ id: 'party-1', status: 'OPEN' }]);
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.findFirst.mockResolvedValue(null);
  });

  const request = () => GET(
    new NextRequest('https://tcgiberia.example/api/parties/party-1'),
    { params: Promise.resolve({ id: 'party-1' }) },
  );

  it('marks an existing participation as ineligible for another purchase', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'participation-1' });
    const response = await request();

    expect((await response.json()).party.hasParticipation).toBe(true);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        partyId: 'party-1',
        userId: 'user-1',
        status: { in: ['PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
      },
      select: { id: true },
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('allows a user without a paid participation to buy or resume checkout', async () => {
    const response = await request();
    expect((await response.json()).party.hasParticipation).toBe(false);
  });

  it('does not look up personal participation for anonymous visitors', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await request();

    expect((await response.json()).party.hasParticipation).toBe(false);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing Party', async () => {
    mocks.getPublicParty.mockResolvedValue([]);
    expect((await request()).status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('reports lookup failures instead of allowing a purchase by default', async () => {
    mocks.findFirst.mockRejectedValue(new Error('Database unavailable'));
    expect((await request()).status).toBe(500);
    expect(mocks.captureServerError).toHaveBeenCalled();
  });
});
