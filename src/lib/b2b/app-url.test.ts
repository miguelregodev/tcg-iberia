import { afterEach, describe, expect, it, vi } from 'vitest';
import { getB2bAppUrl } from './app-url';

afterEach(() => vi.unstubAllEnvs());

describe('B2B email URL origin', () => {
  it('uses the request origin when the public app URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(getB2bAppUrl('https://shop.example.com')).toBe('https://shop.example.com');
  });

  it('normalizes quoted URLs and removes trailing slashes and paths', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', ' "https://shop.example.com/store/" ');
    expect(getB2bAppUrl('https://preview.example.com')).toBe('https://shop.example.com');
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('rejects %s in production', (host) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', `http://${host}:3000`);
    expect(() => getB2bAppUrl('https://shop.example.com')).toThrow('public HTTP(S) URL');
  });

  it('allows local development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(getB2bAppUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it.each(['not-a-url', 'javascript:alert(1)', 'https://user:password@example.com'])(
    'rejects invalid configuration: %s',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', value);
      expect(() => getB2bAppUrl('https://shop.example.com')).toThrow();
    }
  );
});
