import { describe, expect, it } from 'vitest';
import { formatLoyaltyPoints, formatTierMultiplier, serializeTierTrack } from './presentation';

describe('loyalty presentation', () => {
  it('displays whole points rounded down without changing their stored value', () => {
    expect(formatLoyaltyPoints('91.74')).toBe('91');
    expect(formatLoyaltyPoints('999.99')).toBe('999');
    expect(formatLoyaltyPoints('12345.99')).toBe('12.345');
    expect(formatLoyaltyPoints('-0.01')).toBe('-1');
  });

  it('serializes configured tiers in their given order', () => {
    expect(serializeTierTrack([
      { name: 'Inicial', threshold: '0', color: '#123456', multiplier: '1' },
      { name: 'Superior', threshold: '750.50', color: '#abcdef', multiplier: '1.25' },
    ])).toEqual([
      { name: 'Inicial', threshold: '0', color: '#123456', multiplier: '1' },
      { name: 'Superior', threshold: '750.50', color: '#abcdef', multiplier: '1.25' },
    ]);
  });

  it('formats multipliers with Spanish decimals', () => {
    expect(formatTierMultiplier('1.0000')).toBe('x1');
    expect(formatTierMultiplier('1.25')).toBe('x1,25');
  });
});
