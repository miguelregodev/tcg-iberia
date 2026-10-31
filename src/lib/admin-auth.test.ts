import { describe, expect, it } from 'vitest';
import { createAdminSessionToken, verifyAdminSessionToken } from './admin-auth';

describe('admin session token', () => {
  it('accepts a correctly signed token and rejects tampered or expired tokens', async () => {
    const secret = 'test-admin-password';
    const now = Date.UTC(2026, 9, 16, 12);
    const token = await createAdminSessionToken(secret, now);

    expect(await verifyAdminSessionToken(token, secret, now)).toBe(true);
    expect(await verifyAdminSessionToken(`${token}x`, secret, now)).toBe(false);
    expect(await verifyAdminSessionToken(token, 'another-secret', now)).toBe(false);
    expect(await verifyAdminSessionToken(token, secret, now + 24 * 60 * 60 * 1000 + 1000)).toBe(false);
  });
});
