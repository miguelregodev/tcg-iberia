import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLoyaltyCheckoutEnabled, isLoyaltyEnabled, isLoyaltyLocalPreview } from './local-preview';

afterEach(() => vi.unstubAllEnvs());

describe('isLoyaltyLocalPreview', () => {
  it('requires development, test payments and two local database connections', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('REDSYS_ENVIRONMENT', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
    vi.stubEnv('DIRECT_URL', 'postgresql://test:test@127.0.0.1:5432/test');
    expect(isLoyaltyLocalPreview()).toBe(true);
    vi.stubEnv('DIRECT_URL', 'postgresql://test:test@remote.example:5432/test');
    expect(isLoyaltyLocalPreview()).toBe(false);
    vi.stubEnv('DIRECT_URL', 'postgresql://test:test@localhost:5432/test');
    vi.stubEnv('REDSYS_ENVIRONMENT', 'production');
    expect(isLoyaltyLocalPreview()).toBe(false);
    vi.stubEnv('REDSYS_ENVIRONMENT', 'test');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isLoyaltyLocalPreview()).toBe(false);
  });

  it('enables checkout only in local preview and allows an explicit opt-out', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('REDSYS_ENVIRONMENT', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
    vi.stubEnv('DIRECT_URL', 'postgresql://test:test@localhost:5432/test');
    vi.stubEnv('LOYALTY_CHECKOUT_ENABLED', '0');
    expect(isLoyaltyCheckoutEnabled()).toBe(false);
    vi.stubEnv('LOYALTY_CHECKOUT_ENABLED', '');
    expect(isLoyaltyCheckoutEnabled()).toBe(true);
    vi.stubEnv('DIRECT_URL', 'postgresql://test:test@remote.example:5432/test');
    expect(isLoyaltyCheckoutEnabled()).toBe(false);
  });

  it('enables the module in production only with LOYALTY_ENABLED=1 and checkout only with an explicit opt-in', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REDSYS_ENVIRONMENT', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@db.supabase.co:5432/test');
    vi.stubEnv('DIRECT_URL', 'postgresql://test:test@db.supabase.co:5432/test');
    vi.stubEnv('LOYALTY_ENABLED', '');
    vi.stubEnv('LOYALTY_CHECKOUT_ENABLED', '1');
    expect(isLoyaltyEnabled()).toBe(false);
    expect(isLoyaltyCheckoutEnabled()).toBe(false);
    vi.stubEnv('LOYALTY_ENABLED', '1');
    vi.stubEnv('LOYALTY_CHECKOUT_ENABLED', '');
    expect(isLoyaltyEnabled()).toBe(true);
    expect(isLoyaltyLocalPreview()).toBe(false);
    expect(isLoyaltyCheckoutEnabled()).toBe(false);
    vi.stubEnv('LOYALTY_CHECKOUT_ENABLED', '1');
    expect(isLoyaltyCheckoutEnabled()).toBe(true);
  });
});
