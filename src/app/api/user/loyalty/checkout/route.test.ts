import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  auth: vi.fn(),
  price: vi.fn(),
  account: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('@/lib/loyalty/local-preview', () => ({ isLoyaltyCheckoutEnabled: mocks.enabled }));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/orders/pricing', () => ({ priceOrderItems: mocks.price, toShippingItems: () => [] }));
vi.mock('@/lib/shipping/resolve-shipping-cost', () => ({ resolveShippingCost: () => 5 }));
vi.mock('@/lib/loyalty/ledger', () => ({ getLocalAccount: mocks.account }));
vi.mock('@/lib/observability/sentry', () => ({ captureServerError: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));

import { POST } from './route';

const item = { id: 'product', name: 'Producto', price: 999, quantity: 1 };
const request = (redeemAll = true) => new NextRequest('http://localhost/api/user/loyalty/checkout', {
  method: 'POST',
  body: JSON.stringify({ items: [item], postalCode: '28001', groupedShipping: false, redeemAll }),
});

const accountData = ({ balance = 1000, spending = 0 } = {}) => ({
  balance: new Prisma.Decimal(balance), reserved: new Prisma.Decimal(100),
  spending: new Prisma.Decimal(spending),
  config: {
    enabled: true, pointsPerEuro: new Prisma.Decimal(100), minimumRedemption: new Prisma.Decimal(100),
    redemptionIncrement: new Prisma.Decimal(100), maxDiscountPercent: new Prisma.Decimal(20),
    baseRate: new Prisma.Decimal(1),
    tiers: [
      { name: 'Principiante', threshold: new Prisma.Decimal(0), multiplier: new Prisma.Decimal(1), color: '#9CA3AF' },
      { name: 'Avanzado', threshold: new Prisma.Decimal(500), multiplier: new Prisma.Decimal(1.25), color: '#60A5FA' },
    ],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.auth.mockResolvedValue({ user: { id: 'customer' } });
  mocks.price.mockResolvedValue({ ok: true, items: [{ ...item, price: 121 }], products: [] });
  mocks.transaction.mockImplementation((fn) => fn({}));
  mocks.account.mockResolvedValue(accountData());
});

describe('checkout loyalty quote', () => {
  it('requires the local feature and an authenticated customer', async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request())).status).toBe(404);
    mocks.enabled.mockReturnValue(true);
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.price).not.toHaveBeenCalled();
  });

  it('uses server prices, excludes reserved points and includes shipping and tax', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      available: '900', productGross: '121.00', pointsToRedeem: '900.00', discount: '9.00',
      shipping: '5.00', net: '92.56', vat: '19.44', total: '117.00',
      earnedPoints: '126.00', remainingAfterOrder: '407.44',
      tiers: [
        { name: 'Principiante', threshold: '0', color: '#9CA3AF' },
        { name: 'Avanzado', threshold: '500', color: '#60A5FA' },
      ],
    });
  });

  it('applies no points when the customer does not choose to redeem', async () => {
    const response = await POST(request(false));
    expect(await response.json()).toMatchObject({ pointsToRedeem: '0.00', discount: '0.00', total: '126.00', earnedPoints: '126.00' });
  });

  it('calculates earned points with the top tier multiplier and no next tier', async () => {
    mocks.account.mockResolvedValue(accountData({ spending: 600 }));
    const response = await POST(request(false));
    expect(await response.json()).toMatchObject({ earnedPoints: '157.00', remainingAfterOrder: null });
  });

  it('earns points on the order total before the points discount (185.89 € at x1.5 → 278)', async () => {
    const account = accountData({ balance: 3700, spending: 600 });
    account.config.tiers[1].multiplier = new Prisma.Decimal('1.5');
    mocks.account.mockResolvedValue(account);
    mocks.price.mockResolvedValue({ ok: true, items: [{ ...item, price: 180.89 }], products: [] });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pointsToRedeem: '3600.00', discount: '36.00', shipping: '5.00',
      total: '149.89', multiplier: '1.5', earnedPoints: '278.00',
    });
  });

  it('redeems nothing when the unreserved balance is below the minimum', async () => {
    mocks.account.mockResolvedValue(accountData({ balance: 150 }));
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ available: '50', pointsToRedeem: '0.00', discount: '0.00' });
  });

  it('rejects a non-boolean redeemAll flag', async () => {
    const body = JSON.stringify({ items: [item], postalCode: '28001', groupedShipping: false, redeemAll: 'yes' });
    const response = await POST(new NextRequest('http://localhost/api/user/loyalty/checkout', { method: 'POST', body }));
    expect(response.status).toBe(400);
  });
});
