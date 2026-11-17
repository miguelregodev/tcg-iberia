import { describe, expect, it } from 'vitest';
import { isExternalDestination, normalizeHeroDestination } from './destination';

describe('normalizeHeroDestination', () => {
  it('accepts internal paths', () => {
    expect(normalizeHeroDestination('/products')).toEqual({ ok: true, value: '/products' });
    expect(normalizeHeroDestination('  /')).toEqual({ ok: true, value: '/' });
  });

  it('accepts https URLs', () => {
    const result = normalizeHeroDestination('https://example.com/promo');
    expect(result.ok).toBe(true);
  });

  it('rejects protocol-relative URLs', () => {
    expect(normalizeHeroDestination('//evil.example').ok).toBe(false);
  });

  it('rejects non-https schemes', () => {
    expect(normalizeHeroDestination('http://example.com').ok).toBe(false);
    expect(normalizeHeroDestination('javascript:alert(1)').ok).toBe(false);
  });

  it('rejects URLs with credentials', () => {
    expect(normalizeHeroDestination('https://user:pass@example.com').ok).toBe(false);
  });

  it('rejects whitespace, backslashes and empty values', () => {
    expect(normalizeHeroDestination('/a b').ok).toBe(false);
    expect(normalizeHeroDestination('/a\\b').ok).toBe(false);
    expect(normalizeHeroDestination('   ').ok).toBe(false);
  });

  it('rejects values longer than 500 characters', () => {
    expect(normalizeHeroDestination('/' + 'a'.repeat(500)).ok).toBe(false);
  });
});

describe('isExternalDestination', () => {
  it('distinguishes internal and external destinations', () => {
    expect(isExternalDestination('/products')).toBe(false);
    expect(isExternalDestination('https://example.com')).toBe(true);
  });
});
