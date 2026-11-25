import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculateEarnedPoints, calculateTaxExclusiveProducts, calculateTierProgress, determineTier, resolveMaxRedemptionPoints, validateRedemption } from './calculations';

const tiers = [
  { name: 'Principiante', threshold: '0', multiplier: '1' },
  { name: 'Avanzado', threshold: '500', multiplier: '1.25' },
  { name: 'Experto', threshold: '1000', multiplier: '1.50' },
  { name: 'God', threshold: '2000', multiplier: '1.75' },
];

describe('determineTier', () => {
  it.each([
    ['0', 'Principiante'],
    ['499.99', 'Principiante'],
    ['500', 'Avanzado'],
    ['999.99', 'Avanzado'],
    ['1000', 'Experto'],
    ['2000', 'God'],
  ])('selects the tier for %s euros', (spending, expected) => {
    expect(determineTier(tiers, spending).name).toBe(expected);
  });

  it('reflects decreased spending when qualifying orders expire or are refunded', () => {
    expect(determineTier(tiers, '1000').name).toBe('Experto');
    expect(determineTier(tiers, '499.99').name).toBe('Principiante');
  });

  it('rejects invalid configurations and negative spending', () => {
    expect(() => determineTier([], '0')).toThrow();
    expect(() => determineTier(tiers, '-1')).toThrow();
    expect(() => determineTier([{ ...tiers[0], threshold: '1' }], '1')).toThrow();
    expect(() => determineTier([tiers[0], { ...tiers[1], threshold: '0' }], '1')).toThrow();
    expect(() => determineTier([tiers[0], { ...tiers[1], name: 'principiante' }], '1')).toThrow();
    expect(() => determineTier([{ ...tiers[0], multiplier: '0' }], '0')).toThrow();
  });
});

describe('calculateEarnedPoints', () => {
  it.each([
    ['1', '100'],
    ['1.25', '125'],
    ['1.50', '150'],
    ['1.75', '175'],
  ])('applies multiplier %s to 100 euros', (multiplier, expected) => {
    expect(calculateEarnedPoints('100', '1', multiplier).toString()).toBe(expected);
  });

  describe('calculateTierProgress', () => {
    it('calculates progress within the current tier', () => {
      const progress = calculateTierProgress(tiers, '350');
      expect(progress.current.name).toBe('Principiante');
      expect(progress.next?.name).toBe('Avanzado');
      expect(progress.remaining.toString()).toBe('150');
      expect(progress.percentage.toString()).toBe('70');
      expect(calculateTierProgress(tiers, '750').percentage.toString()).toBe('50');
      expect(calculateTierProgress(tiers, '499.99').percentage.toString()).toBe('99.99');
    });

    it('marks the highest tier as complete', () => {
      const progress = calculateTierProgress(tiers, '3000');
      expect(progress.next).toBeNull();
      expect(progress.remaining.toString()).toBe('0');
      expect(progress.percentage.toString()).toBe('100');
    });
  });

  describe('validateRedemption', () => {
    const policy = {
      enabled: true,
      pointsPerEuro: '100',
      minimumPoints: '100',
      incrementPoints: '100',
      maxDiscountPercent: '20',
    };
    const input = {
      points: '100',
      availablePoints: '2000',
      eligibleSubtotalNet: '100',
      eligibleSubtotalGross: '121',
      paymentLimitGross: '121',
      taxRate: '0.21',
    };

    it.each([['100', '1'], ['1000', '10']])('converts %s points to %s euros', (points, euros) => {
      expect(validateRedemption({ ...input, points }, policy).gross.toString()).toBe(euros);
    });

    it('splits the gross discount for the cap but earns points on the discounted paid total', () => {
      const discount = validateRedemption({ ...input, points: '1000' }, policy);
      expect(discount.net.toFixed(2)).toBe('8.26');
      expect(discount.tax.toFixed(2)).toBe('1.74');
      expect(calculateTaxExclusiveProducts('121', input.taxRate).toFixed(2)).toBe('100.00');
      expect(calculateEarnedPoints(new Prisma.Decimal('126').minus(discount.gross), '1', '1').toString()).toBe('116');
    });

    it('enforces minimum, increments, balance, percentage and payment limits', () => {
      expect(() => validateRedemption({ ...input, points: '99' }, policy)).toThrow();
      expect(() => validateRedemption({ ...input, points: '150' }, policy)).toThrow();
      expect(() => validateRedemption({ ...input, points: '1000', availablePoints: '999' }, policy)).toThrow();
      expect(() => validateRedemption({ ...input, points: '2500', availablePoints: '3000' }, policy)).toThrow();
      expect(() => validateRedemption({ ...input, points: '1000', paymentLimitGross: '9.99' }, policy)).toThrow();
      expect(() => validateRedemption(input, { ...policy, enabled: false })).toThrow();
    });

    it('rounds the percentage cap down and rejects fractional euro cents', () => {
      expect(() => validateRedemption({ ...input, eligibleSubtotalNet: '4.14', eligibleSubtotalGross: '5' }, policy)).toThrow();
      expect(() => validateRedemption(input, {
        ...policy, pointsPerEuro: '300',
      })).toThrow();
    });
  });

  it('discards fractional points only after applying the multiplier', () => {
    expect(calculateEarnedPoints('149.89', '1', '1.5').toString()).toBe('224');
    expect(calculateEarnedPoints('0.10', '1', '1.25').toString()).toBe('0');
    expect(calculateEarnedPoints('99.99', '1', '1.75').toString()).toBe('174');
  });

  it('uses the tier before the order for the order crossing the next threshold', () => {
    const tier = determineTier(tiers, '950');
    expect(calculateEarnedPoints('100', '1', tier.multiplier).toString()).toBe('125');
    expect(determineTier(tiers, '1050').name).toBe('Experto');
  });

  it('rejects invalid spend, rates and multipliers', () => {
    expect(() => calculateEarnedPoints('-1', '1', '1')).toThrow();
    expect(() => calculateEarnedPoints('1', '0', '1')).toThrow();
    expect(() => calculateEarnedPoints('1', '1', '-1')).toThrow();
    expect(() => calculateEarnedPoints('NaN', '1', '1')).toThrow();
  });

  describe('resolveMaxRedemptionPoints', () => {
    const policy = {
      enabled: true,
      pointsPerEuro: '100',
      minimumPoints: '100',
      incrementPoints: '100',
      maxDiscountPercent: '20',
    };
    const input = {
      availablePoints: '2000',
      eligibleSubtotalNet: '100',
      eligibleSubtotalGross: '121',
      paymentLimitGross: '121',
      taxRate: '0.21',
    };

    it('uses the largest increment that fits the balance, percentage cap and payment limit', () => {
      expect(resolveMaxRedemptionPoints(input, policy).toString()).toBe('2000');
      expect(resolveMaxRedemptionPoints({ ...input, availablePoints: '5000' }, policy).toString()).toBe('2400');
      expect(resolveMaxRedemptionPoints({ ...input, paymentLimitGross: '9.99' }, policy).toString()).toBe('900');
    });

    it('returns zero when no valid amount exists', () => {
      expect(resolveMaxRedemptionPoints({ ...input, availablePoints: '50' }, policy).toString()).toBe('0');
      expect(resolveMaxRedemptionPoints(input, { ...policy, enabled: false }).toString()).toBe('0');
    });
  });
});
