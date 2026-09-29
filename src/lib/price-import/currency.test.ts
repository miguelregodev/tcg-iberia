import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICE_VARIANT_MARGINS,
  computeVariantPriceBreakdown,
} from './currency';

describe('admin price variant calculations', () => {
  it('uses the requested default margins for each product variant', () => {
    expect(DEFAULT_PRICE_VARIANT_MARGINS.sealed).toBe(25);
    expect(DEFAULT_PRICE_VARIANT_MARGINS.liveOpening).toBe(20);
    expect(DEFAULT_PRICE_VARIANT_MARGINS.b2b).toBe(15);
  });

  it('returns a breakdown for all variants with the configured margin components', () => {
    const breakdown = computeVariantPriceBreakdown(53, DEFAULT_PRICE_VARIANT_MARGINS);

    expect(breakdown.sealed.finalPrice).toBeGreaterThan(0);
    expect(breakdown.liveOpening.finalPrice).toBeLessThan(breakdown.sealed.finalPrice);
    expect(breakdown.b2b.finalPrice).toBeLessThan(breakdown.liveOpening.finalPrice);

    expect(breakdown.sealed.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 25,
    });
    expect(breakdown.liveOpening.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 20,
    });
    expect(breakdown.b2b.marginComponents).toEqual({
      costMarginPercent: 2.7,
      vatPercent: 21,
      profitMarginPercent: 15,
    });
  });

  it('uses the live-opening origin cost for the liveOpening variant when provided', () => {
    const breakdown = computeVariantPriceBreakdown(53, DEFAULT_PRICE_VARIANT_MARGINS, {
      liveOpening: 60,
    });

    expect(breakdown.liveOpening.finalPrice).toBeGreaterThan(breakdown.sealed.finalPrice);
  });
});

