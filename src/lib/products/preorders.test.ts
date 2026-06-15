import { describe, expect, it } from 'vitest';

import { isPreorderProduct } from './state';

describe('preorder homepage ordering prep', () => {
  it('can sort preorders by nearest release date first', () => {
    const releases = [
      '2026-08-15T00:00:00.000Z',
      '2026-07-10T00:00:00.000Z',
      '2026-07-01T00:00:00.000Z',
    ];

    const sorted = [...releases].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    expect(sorted).toEqual([
      '2026-07-01T00:00:00.000Z',
      '2026-07-10T00:00:00.000Z',
      '2026-08-15T00:00:00.000Z',
    ]);
  });

  it('distinguishes preorder and normal products by release date transition', () => {
    const now = new Date('2026-06-15T00:00:00.000Z');

    expect(isPreorderProduct('2026-06-16T00:00:00.000Z', now)).toBe(true);
    expect(isPreorderProduct('2026-06-14T00:00:00.000Z', now)).toBe(false);
  });
});