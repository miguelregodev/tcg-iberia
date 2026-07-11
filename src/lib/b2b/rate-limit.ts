/**
 * B2B rate limiting for login attempts.
 *
 * DB-backed sliding window using the B2bLoginAudit table so it stays correct
 * across serverless invocations (which invalidate any in-memory Maps between
 * requests) and gives admins a persistent audit trail out of the box.
 *
 * Policy:
 *  - Per email:  5 failed attempts within 15 minutes → lock.
 *  - Per IP:     20 failed attempts within 15 minutes → lock.
 *  - Successful logins do NOT reset the counter (a successful attempt from an
 *    attacker mid-brute-force still deserves scrutiny), but the window is
 *    small enough (15 min) that legitimate users won't get stuck.
 */

import { db } from '@/lib/db';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

/**
 * Check whether the (email, ip) pair is currently rate-limited.
 * Returns `true` when the request should be refused with HTTP 429.
 */
export async function isRateLimited(email: string, ipAddress: string | null): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const [emailCount, ipCount] = await Promise.all([
    db.b2bLoginAudit.count({
      where: {
        email: email.toLowerCase(),
        success: false,
        createdAt: { gte: windowStart },
      },
    }),
    ipAddress
      ? db.b2bLoginAudit.count({
          where: {
            ipAddress,
            success: false,
            createdAt: { gte: windowStart },
          },
        })
      : Promise.resolve(0),
  ]);

  return emailCount >= MAX_FAILURES_PER_EMAIL || ipCount >= MAX_FAILURES_PER_IP;
}

/**
 * Record a login attempt in the audit table. This drives both the audit trail
 * and the rate limiter above.
 */
export async function recordLoginAttempt(params: {
  email: string;
  customerId?: string | null;
  success: boolean;
  reason: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    await db.b2bLoginAudit.create({
      data: {
        email: params.email.toLowerCase(),
        customerId: params.customerId ?? null,
        success: params.success,
        reason: params.reason.slice(0, 120),
        ipAddress: params.ipAddress?.slice(0, 64) ?? null,
        userAgent: params.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch {
    // Non-fatal: rate limiting must never block a successful auth.
  }
}
