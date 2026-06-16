import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateRecoveryToken, isTokenExpired } from './token';

describe('generateRecoveryToken', () => {
  it('returns a 64-char hex string', () => {
    const { token } = generateRecoveryToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates unique tokens on each call', () => {
    const a = generateRecoveryToken();
    const b = generateRecoveryToken();
    expect(a.token).not.toBe(b.token);
  });

  it('sets expiry 7 days in the future', () => {
    const before = Date.now();
    const { expiresAt } = generateRecoveryToken();
    const after = Date.now();

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

describe('isTokenExpired', () => {
  it('returns true for null', () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isTokenExpired(undefined)).toBe(true);
  });

  it('returns true for a past date', () => {
    const past = new Date(Date.now() - 1000);
    expect(isTokenExpired(past)).toBe(true);
  });

  it('returns false for a future date', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTokenExpired(future)).toBe(false);
  });
});
