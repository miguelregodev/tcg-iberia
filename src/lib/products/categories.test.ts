import { describe, expect, it } from 'vitest';

import { getCategoryForProductType } from './categories';

describe('getCategoryForProductType', () => {
  it('maps a booster box type to the Booster Boxes category', () => {
    expect(getCategoryForProductType('Booster Box')).toEqual({
      label: 'Booster Boxes',
      href: '/booster-boxes',
    });
  });

  it('is case-insensitive', () => {
    expect(getCategoryForProductType('booster box')).toEqual({
      label: 'Booster Boxes',
      href: '/booster-boxes',
    });
  });

  it('does not let a generic "pack" match shadow a more specific booster box type', () => {
    expect(getCategoryForProductType('Booster Box')?.href).toBe('/booster-boxes');
  });

  it('maps elite trainer box, bundle, mystery, psa and accesorios types', () => {
    expect(getCategoryForProductType('Elite Trainer Box')?.href).toBe('/etbs');
    expect(getCategoryForProductType('Booster Bundle')?.href).toBe('/booster-bundles');
    expect(getCategoryForProductType('Booster Pack')?.href).toBe('/booster-packs');
    expect(getCategoryForProductType('Mystery')?.href).toBe('/mystery-packs');
    expect(getCategoryForProductType('PSA')?.href).toBe('/psa');
    expect(getCategoryForProductType('Accesorios')?.href).toBe('/accesorios');
  });

  it('returns null for unknown or missing types', () => {
    expect(getCategoryForProductType('Single Card')).toBeNull();
    expect(getCategoryForProductType(null)).toBeNull();
    expect(getCategoryForProductType(undefined)).toBeNull();
  });
});
