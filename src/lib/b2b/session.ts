/**
 * B2B session helpers.
 *
 * The B2B system uses its own session cookie (`b2b_session`) that is entirely
 * separate from NextAuth's customer sessions and from the admin panel cookie.
 * Sessions are opaque random tokens stored hashed in `B2bSession` — see
 * `./tokens.ts` for the token construction details.
 *
 * Cookie characteristics:
 *   - HttpOnly     — never readable from JavaScript
 *   - Secure       — HTTPS-only in production
 *   - SameSite=Lax — blocks cross-origin CSRF on state-changing requests
 *                     while still allowing top-level navigations
 *   - Path=/       — usable across the whole app
 */

import type { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { hashToken, issueSessionToken, B2B_SESSION_TTL_DAYS } from './tokens';
import type { B2bCustomer, B2bCustomerStatus } from '@prisma/client';

export const B2B_SESSION_COOKIE = 'b2b_session';

const isProd = process.env.NODE_ENV === 'production';

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge?: number;
  expires?: Date;
}

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * Create a session row and attach the cookie to the given response.
 * Returns the raw token so callers can log it if needed (they typically don't).
 */
export async function createB2bSession(
  customerId: string,
  response: NextResponse,
  meta?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<string> {
  const { raw, hash, expiresAt } = issueSessionToken();

  await db.b2bSession.create({
    data: {
      customerId,
      tokenHash: hash,
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 500) ?? null,
      ipAddress: meta?.ipAddress?.slice(0, 64) ?? null,
    },
  });

  response.cookies.set(B2B_SESSION_COOKIE, raw, {
    ...baseCookieOptions(),
    expires: expiresAt,
    maxAge: B2B_SESSION_TTL_DAYS * 24 * 60 * 60,
  });

  return raw;
}

/**
 * Look up the active B2B session tied to the request's cookie, if any.
 * Returns `null` when there is no cookie, the token is unknown, the session
 * has expired, or the customer is DISABLED / PENDING.
 *
 * Never throws — designed to be called from arbitrary API routes and pages.
 */
export async function getB2bSessionFromRequest(
  request: NextRequest
): Promise<{
  customer: B2bCustomer;
} | null> {
  const raw = request.cookies.get(B2B_SESSION_COOKIE)?.value;
  if (!raw) return null;

  return lookupSession(raw);
}

/**
 * Server-component variant that reads the cookie via next/headers.
 */
export async function getB2bSessionFromCookies(): Promise<{
  customer: B2bCustomer;
} | null> {
  const store = await cookies();
  const raw = store.get(B2B_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return lookupSession(raw);
}

async function lookupSession(rawToken: string): Promise<{ customer: B2bCustomer } | null> {
  try {
    const tokenHash = hashToken(rawToken);
    const session = await db.b2bSession.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    if (!session.customer) return null;

    // Fire-and-forget "last seen" bump — no need to await.
    void db.b2bSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {
        // Non-fatal — session read must succeed even if the write fails.
      });

    return { customer: session.customer };
  } catch {
    return null;
  }
}

/**
 * Return the customer only if they are ACTIVE — used by endpoints that must
 * refuse both PENDING and DISABLED accounts.
 */
export async function getActiveB2bCustomer(
  request: NextRequest
): Promise<B2bCustomer | null> {
  const session = await getB2bSessionFromRequest(request);
  if (!session) return null;
  return session.customer.status === 'ACTIVE' ? session.customer : null;
}

/**
 * Destroy the current session (both DB row and cookie).
 */
export async function destroyB2bSession(
  request: NextRequest,
  response: NextResponse
): Promise<void> {
  const raw = request.cookies.get(B2B_SESSION_COOKIE)?.value;
  if (raw) {
    try {
      await db.b2bSession.delete({ where: { tokenHash: hashToken(raw) } });
    } catch {
      // Session already gone — ignore.
    }
  }
  response.cookies.set(B2B_SESSION_COOKIE, '', {
    ...baseCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Whether a B2B customer with the given status is allowed into the wholesale
 * area. Used by both the request-level guard and the API refusal helper.
 */
export function isB2bStatusAllowed(status: B2bCustomerStatus): boolean {
  return status === 'ACTIVE';
}
