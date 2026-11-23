import { describe, expect, it } from 'vitest';
import { parseOrderLines, parseShippingCost, priceB2bOrder, type PricingProduct } from './pricing';

const product = (over: Partial<PricingProduct> = {}): PricingProduct => ({
  id: 'p1',
  name: 'Booster Box SV',
  slug: 'booster-box-sv',
  language: 'JAPANESE',
  imageUrl: 'https://img/p1.png',
  b2bPrice: 121, // stored VAT-included → 100.00 net
  visible: true,
  ...over,
});

describe('priceB2bOrder', () => {
  it('applies the B2B net price, line discounts, shipping VAT and totals in cents', () => {
    const products = new Map([
      ['p1', product()],
      ['p2', product({ id: 'p2', name: 'ETB', slug: 'etb', b2bPrice: 60.5 })], // 50.00 net
    ]);
    const result = priceB2bOrder(
      [
        { productId: 'p1', quantity: 3, discountPercent: 10 },
        { productId: 'p2', quantity: 1, discountPercent: 0 },
      ],
      products,
      { shippingCostCents: 1250 }
    );

    expect(result.items[0]).toMatchObject({
      name: 'Booster Box SV',
      sku: 'booster-box-sv',
      language: 'JAPANESE',
      imageUrl: 'https://img/p1.png',
      unitPriceEur: 100,
      discountPercent: 10,
      discountAmountEur: 30,
      lineTotal: 270,
      vatRate: 0.21,
    });
    expect(result.subtotal).toBe(320);
    expect(result.discountTotal).toBe(30);
    expect(result.shippingCost).toBe(12.5);
    expect(result.ivaAmount).toBe(69.83); // (320 + 12.50) × 21% = 69.825 → 69.83
    expect(result.total).toBe(402.33);
  });

  it('adds Recargo de Equivalencia (5.2%) on the taxable base, after IVA', () => {
    const products = new Map([['p1', product()]]); // 100.00 net
    const result = priceB2bOrder([{ productId: 'p1', quantity: 2, discountPercent: 0 }], products, {
      shippingCostCents: 1000,
      surchargeRate: 0.052,
    });
    // base 210.00 → IVA 44.10, RE 10.92
    expect(result.ivaAmount).toBe(44.1);
    expect(result.surchargeRate).toBe(0.052);
    expect(result.surchargeAmount).toBe(10.92);
    expect(result.total).toBe(265.02);

    const without = priceB2bOrder([{ productId: 'p1', quantity: 2, discountPercent: 0 }], products, { shippingCostCents: 1000 });
    expect(without.surchargeAmount).toBe(0);
    expect(without.total).toBe(254.1);
  });

  it('avoids floating point drift on many small lines', () => {
    const products = new Map([['p1', product({ b2bPrice: 0.12 })]]); // 0.10 net
    const result = priceB2bOrder([{ productId: 'p1', quantity: 999, discountPercent: 0 }], products);
    expect(result.subtotal).toBe(99.9);
    expect(result.total).toBe(120.88);
  });

  it('rejects hidden, unknown and unpriced products', () => {
    const products = new Map([
      ['hidden', product({ id: 'hidden', visible: false })],
      ['noprice', product({ id: 'noprice', b2bPrice: null })],
    ]);
    const result = priceB2bOrder(
      [
        { productId: 'hidden', quantity: 1, discountPercent: 0 },
        { productId: 'noprice', quantity: 1, discountPercent: 0 },
        { productId: 'missing', quantity: 1, discountPercent: 0 },
      ],
      products
    );
    expect(result.items).toEqual([]);
    expect(result.rejections).toEqual([
      { productId: 'hidden', reason: 'unavailable' },
      { productId: 'noprice', reason: 'no_price' },
      { productId: 'missing', reason: 'unavailable' },
    ]);
  });
});

describe('parseOrderLines', () => {
  it('strict mode reports invalid quantities, discounts and duplicates', () => {
    const { errors } = parseOrderLines(
      [
        { productId: 'a', quantity: 0 },
        { productId: 'b', quantity: 1.5 },
        { productId: 'c', quantity: 1000 },
        { productId: 'd', quantity: 1, discountPercent: 101 },
        { productId: 'e', quantity: 1, discountPercent: 5.555 },
        { productId: 'f', quantity: 1 },
        { productId: 'f', quantity: 2 },
      ],
      { strict: true, allowDiscount: true }
    );
    expect(errors).toHaveLength(6);
  });

  it('lenient mode drops invalid lines, merges duplicates and ignores client discounts', () => {
    const { lines, errors } = parseOrderLines(
      [
        { productId: 'a', quantity: 2, discountPercent: 50 },
        { productId: 'a', quantity: '3' },
        { productId: '', quantity: 1 },
        { productId: 'b', quantity: -1 },
      ],
      { strict: false, allowDiscount: false }
    );
    expect(errors).toEqual([]);
    expect(lines).toEqual([{ productId: 'a', quantity: 5, discountPercent: 0 }]);
  });

  it('rejects empty or oversized orders', () => {
    expect(parseOrderLines([], { strict: true, allowDiscount: true }).errors[0]).toMatch(/no contiene/);
    const many = Array.from({ length: 101 }, (_, i) => ({ productId: `p${i}`, quantity: 1 }));
    expect(parseOrderLines(many, { strict: true, allowDiscount: true }).errors[0]).toMatch(/máximo/);
  });
});

describe('parseShippingCost', () => {
  it('accepts non-negative amounts with up to 2 decimals', () => {
    expect(parseShippingCost(undefined)).toEqual({ cents: 0 });
    expect(parseShippingCost('12.35')).toEqual({ cents: 1235 });
    expect(parseShippingCost(-1)).toHaveProperty('error');
    expect(parseShippingCost(1.234)).toHaveProperty('error');
    expect(parseShippingCost('abc')).toHaveProperty('error');
  });
});
