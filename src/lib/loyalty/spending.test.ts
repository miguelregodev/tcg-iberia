import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { legacyOrderEligibleSpend } from './spending';

const total = (value: string) => new Prisma.Decimal(value);

describe('legacyOrderEligibleSpend', () => {
  it('uses discounted product lines without VAT and ignores shipping included in the total', () => {
    const items = [
      { id: 'a', name: 'A', price: 100, quantity: 2, discountPercentage: 10 },
      { id: 'b', name: 'B', price: 63, quantity: 1 },
    ];
    // 180 + 63 = 243 gross products; total also contains 5.99 shipping.
    expect(legacyOrderEligibleSpend(items, total('248.99')).toString()).toBe('200.83');
  });

  it('never exceeds what was actually charged', () => {
    expect(legacyOrderEligibleSpend([{ price: 121, quantity: 1 }], total('60.50')).toString()).toBe('50');
  });

  it('counts unreadable snapshots as zero instead of guessing from the total', () => {
    expect(legacyOrderEligibleSpend(null, total('100')).toString()).toBe('0');
    expect(legacyOrderEligibleSpend([{ price: '10', quantity: 1 }], total('100')).toString()).toBe('0');
    expect(legacyOrderEligibleSpend([{ price: 10, quantity: 0 }], total('100')).toString()).toBe('0');
  });
});
