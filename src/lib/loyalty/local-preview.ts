function isLocalDatabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The incomplete preview must never run with a deployed app or remote database.
 * The program configuration still has to be explicitly enabled in that database.
 */
export function isLoyaltyLocalPreview(): boolean {
  return process.env.NODE_ENV === 'development' &&
    process.env.REDSYS_ENVIRONMENT === 'test' &&
    isLocalDatabase(process.env.DATABASE_URL) &&
    isLocalDatabase(process.env.DIRECT_URL);
}

export function isLoyaltyCheckoutEnabled(): boolean {
  return isLoyaltyLocalPreview() && process.env.LOYALTY_CHECKOUT_ENABLED !== '0';
}
