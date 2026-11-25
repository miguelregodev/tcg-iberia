import { describe, expect, it } from 'vitest';
import { getLoyaltyWindowStart } from './window';

describe('getLoyaltyWindowStart', () => {
  it('includes the current Madrid date and 59 preceding dates', () => {
    expect(getLoyaltyWindowStart(new Date('2026-11-24T12:00:00Z'), 60).toISOString())
      .toBe('2026-09-25T22:00:00.000Z');
  });

  it('uses the Madrid date even when it differs from UTC', () => {
    expect(getLoyaltyWindowStart(new Date('2026-01-01T23:30:00Z'), 1).toISOString())
      .toBe('2026-01-01T23:00:00.000Z');
  });

  it('uses the offset at the start of the window, including DST changes', () => {
    expect(getLoyaltyWindowStart(new Date('2026-04-15T12:00:00Z'), 30).toISOString())
      .toBe('2026-03-16T23:00:00.000Z');
  });

  it('rejects invalid dates and window sizes', () => {
    expect(() => getLoyaltyWindowStart(new Date('invalid'), 60)).toThrow();
    expect(() => getLoyaltyWindowStart(new Date(), 0)).toThrow();
    expect(() => getLoyaltyWindowStart(new Date(), 1.5)).toThrow();
  });
});
