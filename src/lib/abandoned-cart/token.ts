import crypto from 'crypto';

/** Recovery token is 64 hex chars (32 random bytes). */
const TOKEN_BYTES = 32;
/** Recovery links expire after 7 days. */
const TOKEN_EXPIRY_DAYS = 7;

export function generateRecoveryToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);
  return { token, expiresAt };
}

export function isTokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}
