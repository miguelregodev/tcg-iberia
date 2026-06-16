import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — the factory must not reference variables defined outside it.
vi.mock('@/lib/db', () => ({
  db: {
    abandonedCart: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { db } from '@/lib/db';
import {
  syncCart,
  associateGuestEmail,
  markCartCompletedByStripeSession,
  getCartByRecoveryToken,
  markCartRecovered,
} from './tracker';

// Typed shorthand to avoid repeated casts.
const mockAC = db.abandonedCart as {
  upsert: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// --- syncCart ---

describe('syncCart', () => {
  it('marks cart COMPLETED when items are empty', async () => {
    mockAC.updateMany.mockResolvedValue({ count: 1 });
    await syncCart({ sessionKey: 'test-key', items: [], totalAmount: 0 });
    expect(mockAC.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionKey: 'test-key', status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(mockAC.upsert).not.toHaveBeenCalled();
  });

  it('upserts cart when items are present', async () => {
    mockAC.upsert.mockResolvedValue({});
    await syncCart({
      sessionKey: 'test-key',
      userId: 'user-1',
      items: [{ id: 'p1', name: 'Card', quantity: 2, price: 10 }],
      totalAmount: 20,
    });
    expect(mockAC.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionKey: 'test-key' },
        create: expect.objectContaining({ userId: 'user-1', status: 'ACTIVE' }),
        update: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('normalises guestEmail to lowercase', async () => {
    mockAC.upsert.mockResolvedValue({});
    await syncCart({
      sessionKey: 'k',
      guestEmail: 'USER@EXAMPLE.COM',
      items: [{ id: 'p1', name: 'Card', quantity: 1, price: 5 }],
      totalAmount: 5,
    });
    const call = mockAC.upsert.mock.calls[0][0];
    expect(call.create.guestEmail).toBe('user@example.com');
  });
});

// --- associateGuestEmail ---

describe('associateGuestEmail', () => {
  it('updates the cart with normalised email', async () => {
    mockAC.updateMany.mockResolvedValue({ count: 1 });
    await associateGuestEmail('sess-key', 'Test@Email.com');
    expect(mockAC.updateMany).toHaveBeenCalledWith({
      where: { sessionKey: 'sess-key', status: 'ACTIVE' },
      data: { guestEmail: 'test@email.com' },
    });
  });
});

// --- markCartCompletedByStripeSession ---

describe('markCartCompletedByStripeSession', () => {
  it('marks all matching carts COMPLETED', async () => {
    mockAC.updateMany.mockResolvedValue({ count: 1 });
    await markCartCompletedByStripeSession('sess_stripe_123');
    expect(mockAC.updateMany).toHaveBeenCalledWith({
      where: { stripeSessionId: 'sess_stripe_123' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });
});

// --- getCartByRecoveryToken ---

describe('getCartByRecoveryToken', () => {
  it('returns null for unknown token', async () => {
    mockAC.findUnique.mockResolvedValue(null);
    const result = await getCartByRecoveryToken('bad-token');
    expect(result).toBeNull();
  });

  it('returns null for COMPLETED cart', async () => {
    mockAC.findUnique.mockResolvedValue({
      id: '1',
      status: 'COMPLETED',
      items: [],
      totalAmount: 0,
      sessionKey: 'k',
      recoveryTokenExpiresAt: new Date(Date.now() + 1_000_000),
    });
    const result = await getCartByRecoveryToken('some-token');
    expect(result).toBeNull();
  });

  it('returns null for expired token', async () => {
    mockAC.findUnique.mockResolvedValue({
      id: '1',
      status: 'ABANDONED',
      items: [],
      totalAmount: 0,
      sessionKey: 'k',
      recoveryTokenExpiresAt: new Date(Date.now() - 1000), // expired
    });
    const result = await getCartByRecoveryToken('some-token');
    expect(result).toBeNull();
  });

  it('returns cart for valid token', async () => {
    const cart = {
      id: '1',
      status: 'ABANDONED',
      items: [{ id: 'p1', name: 'Card', quantity: 1, price: 10 }],
      totalAmount: 10,
      sessionKey: 'valid-key',
      recoveryTokenExpiresAt: new Date(Date.now() + 1_000_000),
    };
    mockAC.findUnique.mockResolvedValue(cart);
    const result = await getCartByRecoveryToken('valid-token');
    expect(result).toEqual(cart);
  });
});

// --- markCartRecovered ---

describe('markCartRecovered', () => {
  it('sets status to RECOVERED', async () => {
    mockAC.update.mockResolvedValue({});
    await markCartRecovered('cart-id-1');
    expect(mockAC.update).toHaveBeenCalledWith({
      where: { id: 'cart-id-1' },
      data: expect.objectContaining({ status: 'RECOVERED' }),
    });
  });
});
