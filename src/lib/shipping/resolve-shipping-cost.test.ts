import { describe, expect, it } from 'vitest';
import { resolveShippingCost } from './resolve-shipping-cost';

// Items without weight/dimension data force the calculator into its "unavailable"
// fallback branch, which is the path exercised by grouped-shipment fee calculations
// whenever combined order items lack full product shipping metadata.
const itemWithoutShippingData = [{ quantity: 1, weightGrams: null }];

describe('resolveShippingCost', () => {
  it('charges the standard fallback cost below the free-shipping threshold', () => {
    const cost = resolveShippingCost(itemWithoutShippingData, '28001', 80, 200, 6.95);
    expect(cost).toBe(6.95);
  });

  it('is free once the combined value reaches the threshold', () => {
    const cost = resolveShippingCost(itemWithoutShippingData, '28001', 210, 200, 6.95);
    expect(cost).toBe(0);
  });

  it('is free exactly at the threshold', () => {
    const cost = resolveShippingCost(itemWithoutShippingData, '28001', 200, 200, 6.95);
    expect(cost).toBe(0);
  });

  it('never applies the free-shipping threshold in the Canary Islands', () => {
    const cost = resolveShippingCost(itemWithoutShippingData, '35001', 500, 200, 6.95);
    expect(cost).toBe(6.95);
  });

  it('never returns a negative shipping cost', () => {
    const cost = resolveShippingCost(itemWithoutShippingData, '28001', 1000, 200, 6.95);
    expect(cost).toBeGreaterThanOrEqual(0);
  });
});
