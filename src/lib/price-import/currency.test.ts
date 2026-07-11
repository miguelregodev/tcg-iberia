import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICE_VARIANT_MARGINS,
  computeVariantPriceBreakdown,
} from './currency';

describe('admin price variant calculations', () => {
  it('uses the requested default margins for each product variant', () => {
    expect(DEFAULT_PRICE_VARIANT_MARGINS.shrink).toBe(25);
    expect(DEFAULT_PRICE_VARIANT_MARGINS.noShrink).toBe(20);
    expect(DEFAULT_PRICE_VARIANT_MARGINS.b2b).toBe(15);
    expect(DEFAULT_PRICE_VARIANT_MARGINS.b2bNoShrink).toBe(12);
  });

  it('returns a breakdown for all four variants with the configured margin components', () => {
    const breakdown = computeVariantPriceBreakdown(53, DEFAULT_PRICE_VARIANT_MARGINS);

    expect(breakdown.shrink.finalPrice).toBeGreaterThan(0);
    expect(breakdown.noShrink.finalPrice).toBeLessThan(breakdown.shrink.finalPrice);
    expect(breakdown.b2b.finalPrice).toBeLessThan(breakdown.noShrink.finalPrice);
    expect(breakdown.b2bNoShrink.finalPrice).toBeLessThan(breakdown.b2b.finalPrice);

    expect(breakdown.shrink.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 25,
    });
    expect(breakdown.noShrink.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 20,
    });
    expect(breakdown.b2b.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 15,
    });
    expect(breakdown.b2bNoShrink.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 12,
    });
  });

  it('uses the no-shrink origin cost for the noShrink and b2bNoShrink variants when provided', () => {
    const breakdown = computeVariantPriceBreakdown(53, DEFAULT_PRICE_VARIANT_MARGINS, {
      noShrink: 60,
      b2bNoShrink: 60,
    });

    expect(breakdown.noShrink.finalPrice).toBeGreaterThan(breakdown.shrink.finalPrice);
    expect(breakdown.b2bNoShrink.finalPrice).toBeGreaterThan(breakdown.b2b.finalPrice);
  });
});
