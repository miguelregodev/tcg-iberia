import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

const ADMIN_SESSION_TTL_SECONDS = 24 * 60 * 60;

function signTimestamp(timestamp: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(timestamp).digest();
}

export function createAdminSessionToken(
  secret: string,
  now = Date.now(),
): string {
  const timestamp = String(Math.floor(now / 1000));
  return `${timestamp}.${signTimestamp(timestamp, secret).toString('hex')}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const [timestamp, providedSignature, extra] = token.split('.');
  if (extra !== undefined || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(providedSignature)) {
    return false;
  }
  const issuedAt = Number(timestamp);
  const nowSeconds = Math.floor(now / 1000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > nowSeconds + 30 ||
    nowSeconds - issuedAt > ADMIN_SESSION_TTL_SECONDS
  ) {
    return false;
  }
  const expectedSignature = signTimestamp(timestamp, secret);
  const receivedSignature = Buffer.from(providedSignature, 'hex');
  return (
    receivedSignature.length === expectedSignature.length &&
    timingSafeEqual(expectedSignature, receivedSignature)
  );
}

export function isAdminAuthenticated(request: NextRequest): boolean {
  return verifyAdminSessionToken(
    request.cookies.get('tcg_admin_auth')?.value,
    process.env.ADMIN_PASSWORD,
  );
}
