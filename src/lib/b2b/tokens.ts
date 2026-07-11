/**
 * B2B token helpers.
 *
 * Both session tokens and activation tokens follow the same pattern:
 *   - The raw token is a URL-safe random string (32 bytes → 43 chars).
 *   - Only its SHA-256 hash is persisted in the database.
 *   - The raw token is delivered exactly once (in a cookie or in an email).
 *
 * This prevents a leaked database from being replayed to gain access.
 */

import { createHash, randomBytes } from 'crypto';

/** Session cookie lifetime (30 days). */
export const B2B_SESSION_TTL_DAYS = 30;

/** Activation link lifetime (72 hours = 3 days). */
export const B2B_ACTIVATION_TOKEN_TTL_HOURS = 72;

/** Generate a cryptographically-random, URL-safe token (Base64url, no padding). */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a token for storage. Uses SHA-256 (not bcrypt) because these tokens
 * already contain 256 bits of entropy — the goal is not to slow guessing,
 * but to make the DB representation useless if leaked.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Convenience: returns { raw, hash, expiresAt } for a new session token. */
export function issueSessionToken(): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = generateRawToken();
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + B2B_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

/** Convenience: returns { raw, hash, expiresAt } for a new activation token. */
export function issueActivationToken(): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = generateRawToken();
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + B2B_ACTIVATION_TOKEN_TTL_HOURS * 60 * 60 * 1000),
  };
}
