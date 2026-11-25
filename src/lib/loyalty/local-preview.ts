function isLocalDatabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Local development against a local database with Redsys in test mode. */
export function isLoyaltyLocalPreview(): boolean {
  return process.env.NODE_ENV === 'development' &&
    process.env.REDSYS_ENVIRONMENT === 'test' &&
    isLocalDatabase(process.env.DATABASE_URL) &&
    isLocalDatabase(process.env.DIRECT_URL);
}

/**
 * Makes the loyalty module available (admin, customer account and APIs).
 * Outside the local preview it must be enabled explicitly with LOYALTY_ENABLED=1.
 * The program configuration still has to be enabled in the database.
 */
export function isLoyaltyEnabled(): boolean {
  return process.env.LOYALTY_ENABLED === '1' || isLoyaltyLocalPreview();
}

/**
 * Earning and redeeming points at checkout. On by default in the local preview
 * (opt-out with LOYALTY_CHECKOUT_ENABLED=0); elsewhere it requires LOYALTY_CHECKOUT_ENABLED=1.
 */
export function isLoyaltyCheckoutEnabled(): boolean {
  if (!isLoyaltyEnabled()) return false;
  if (isLoyaltyLocalPreview()) return process.env.LOYALTY_CHECKOUT_ENABLED !== '0';
  return process.env.LOYALTY_CHECKOUT_ENABLED === '1';
}