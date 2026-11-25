import { describe, expect, it } from 'vitest';
import { parseLoyaltyConfig } from './config';

const config = {
  baseRate: '1',
  pointsPerEuro: '100',
  minimumRedemption: '100',
  redemptionIncrement: '100',
  maxDiscountPercent: '20',
  evaluationDays: 60,
  expirationMonths: 12,
  tiers: [
    { name: 'Principiante', threshold: '0', multiplier: '1', description: '', color: '#123456', icon: '', benefits: [] },
    { name: 'Avanzado', threshold: '500', multiplier: '1.25', description: '', color: '#abcdef', icon: 'star', benefits: [] },
  ],
};

describe('parseLoyaltyConfig', () => {
  it('accepts and normalizes a valid configuration', () => {
    expect(parseLoyaltyConfig(config).tiers[1].threshold).toBe('500');
  });

  it('rejects invalid limits, precision and periods', () => {
    expect(() => parseLoyaltyConfig({ ...config, maxDiscountPercent: '101' })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, baseRate: '1.00001' })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, minimumRedemption: '0' })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, evaluationDays: 0 })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, expirationMonths: 1.5 })).toThrow();
  });

  it('rejects unordered thresholds, duplicate names and invalid presentation data', () => {
    expect(() => parseLoyaltyConfig({ ...config, tiers: [config.tiers[1], config.tiers[0]] })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, tiers: [config.tiers[0], { ...config.tiers[1], name: 'principiante' }] })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, tiers: [{ ...config.tiers[0], color: 'red' }] })).toThrow();
    expect(() => parseLoyaltyConfig({ ...config, tiers: [{ ...config.tiers[0], benefits: [''] }] })).toThrow();
  });
});
