import { describe, it, expect } from 'vitest';
import { estimateShippingCost } from './client-calculator';
import { isCeutaPostalCode } from './postal-codes';

const light = [{ quantity: 1, weightGrams: 500 }];

describe('isCeutaPostalCode', () => {
  it('detects Ceuta postal codes (prefix 51)', () => {
    expect(isCeutaPostalCode('51001')).toBe(true);
    expect(isCeutaPostalCode('51 001')).toBe(true);
  });

  it('rejects non-Ceuta postal codes', () => {
    expect(isCeutaPostalCode('52001')).toBe(false); // Melilla
    expect(isCeutaPostalCode('28001')).toBe(false);
    expect(isCeutaPostalCode('')).toBe(false);
  });
});

describe('estimateShippingCost', () => {
  it('charges Ceuta the same tier amounts as Balearic Islands', () => {
    expect(estimateShippingCost(light, '51001')).toBe(estimateShippingCost(light, '07001'));
    expect(estimateShippingCost(light, '51001')).toBe(6.99);
  });

  it('keeps standard pricing for mainland postal codes', () => {
    expect(estimateShippingCost(light, '28001')).toBe(3.99);
  });
});
