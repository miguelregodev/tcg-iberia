import { describe, expect, it } from 'vitest';
import { calculateExpiration } from './expiration';

describe('calculateExpiration', () => {
  it('uses Madrid calendar months and preserves the local time', () => {
    expect(calculateExpiration(new Date('2026-03-15T12:30:45.123Z'), 1).toISOString())
      .toBe('2026-04-15T11:30:45.123Z');
  });

  it('clamps dates at the end of the month', () => {
    expect(calculateExpiration(new Date('2024-02-29T11:00:00Z'), 12).toISOString())
      .toBe('2025-02-28T11:00:00.000Z');
  });

  it('moves a nonexistent Madrid local time to the first valid minute', () => {
    expect(calculateExpiration(new Date('2025-03-29T01:30:00Z'), 12).toISOString())
      .toBe('2026-03-29T01:00:00.000Z');
  });
});
