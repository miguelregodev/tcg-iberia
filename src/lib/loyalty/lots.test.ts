import { describe, expect, it } from 'vitest';
import { allocatePoints, proportionalPointReversal } from './lots';

const now = new Date('2026-11-24T12:00:00Z');
const lots = [
  { id: 'later', remainingPoints: '100', expiresAt: new Date('2027-03-01T00:00:00Z'), createdAt: new Date('2026-03-01T00:00:00Z') },
  { id: 'expired', remainingPoints: '100', expiresAt: now, createdAt: new Date('2025-11-24T00:00:00Z') },
  { id: 'earlier', remainingPoints: '25.50', expiresAt: new Date('2026-12-01T00:00:00Z'), createdAt: new Date('2025-12-01T00:00:00Z') },
  { id: 'unlimited', remainingPoints: '100', expiresAt: null, createdAt: new Date('2025-01-01T00:00:00Z') },
];

describe('allocatePoints', () => {
  it('uses the earliest unexpired lots first and never consumes expired points', () => {
    const result = allocatePoints(lots, '150', '225.50', now);
    expect(result.map((entry) => [entry.lotId, entry.points.toString()])).toEqual([
      ['earlier', '25.5'], ['later', '100'], ['unlimited', '24.5'],
    ]);
  });

  it('rejects spending over the available balance or unexpired lot amounts', () => {
    expect(() => allocatePoints(lots, '100', '99', now)).toThrow();
    expect(() => allocatePoints(lots, '226', '300', now)).toThrow();
    expect(() => allocatePoints(lots, '0', '300', now)).toThrow();
    expect(() => allocatePoints([...lots, lots[0]], '100', '300', now)).toThrow();
  });
});

describe('proportionalPointReversal', () => {
  it('rounds cumulatively so a full refund reverses exactly the original points', () => {
    const first = proportionalPointReversal('1', '3', '1', '0');
    const second = proportionalPointReversal('1', '3', '2', first);
    const third = proportionalPointReversal('1', '3', '3', first.plus(second));
    expect([first.toFixed(2), second.toFixed(2), third.toFixed(2)]).toEqual(['0.33', '0.34', '0.33']);
  });

  it('rejects over-refunds and inconsistent previous reversals', () => {
    expect(() => proportionalPointReversal('10', '100', '101', '0')).toThrow();
    expect(() => proportionalPointReversal('10', '100', '50', '6')).toThrow();
  });
});
