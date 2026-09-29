import { describe, it, expect } from 'vitest';
import {
  calculateShippingCost,
  isCanaryIslandsPostalCode,
  ShippingItem,
} from './shipping-calculator';

describe('Shipping Calculator', () => {
  const FREE_SHIPPING_THRESHOLD = 200; // EUR

  describe('isCanaryIslandsPostalCode', () => {
    it('should detect Gran Canaria postal codes (35xxx)', () => {
      expect(isCanaryIslandsPostalCode('35001')).toBe(true);
      expect(isCanaryIslandsPostalCode('35010')).toBe(true);
      expect(isCanaryIslandsPostalCode('35500')).toBe(true);
    });

    it('should detect Tenerife postal codes (38xxx)', () => {
      expect(isCanaryIslandsPostalCode('38001')).toBe(true);
      expect(isCanaryIslandsPostalCode('38010')).toBe(true);
      expect(isCanaryIslandsPostalCode('38500')).toBe(true);
    });

    it('should reject mainland Spanish postal codes', () => {
      expect(isCanaryIslandsPostalCode('28001')).toBe(false); // Madrid
      expect(isCanaryIslandsPostalCode('08001')).toBe(false); // Barcelona
      expect(isCanaryIslandsPostalCode('41001')).toBe(false); // Seville
      expect(isCanaryIslandsPostalCode('46001')).toBe(false); // Valencia
    });

    it('should handle postal codes with spaces', () => {
      expect(isCanaryIslandsPostalCode('35 001')).toBe(true);
      expect(isCanaryIslandsPostalCode('38 010')).toBe(true);
    });

    it('should handle empty or invalid inputs', () => {
      expect(isCanaryIslandsPostalCode('')).toBe(false);
      expect(isCanaryIslandsPostalCode('   ')).toBe(false);
    });
  });

  describe('Standard shipping - Tier 1 (≤2kg, ≤30x20x20)', () => {
    const item: ShippingItem = {
      quantity: 1,
      weightGrams: 1500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 20,
    };

    it('should charge €4.99 for 1500g / 30x20x20', () => {
      const result = calculateShippingCost(
        [item],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(4.99);
      expect(result.isFree).toBe(false);
      expect(result.zone).toBe('STANDARD');
    });

    it('should charge €4.99 for exactly 2000g', () => {
      const result = calculateShippingCost(
        [{ ...item, weightGrams: 2000 }],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(4.99);
    });

    it('should be free if subtotal >= €200', () => {
      const result = calculateShippingCost(
        [item],
        '28001',
        200,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(0);
      expect(result.isFree).toBe(true);
    });

    it('should handle dimension order independence (20x30x20)', () => {
      const result = calculateShippingCost(
        [{ ...item, lengthCm: 20, widthCm: 30, heightCm: 20 }],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(4.99);
    });
  });

  describe('Standard shipping - Tier 2 (2001-5000g, ≤35x24x35)', () => {
    const item: ShippingItem = {
      quantity: 1,
      weightGrams: 2001,
      lengthCm: 35,
      widthCm: 24,
      heightCm: 35,
    };

    it('should charge €5.99 for 2001g / 35x24x35', () => {
      const result = calculateShippingCost(
        [item],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(5.99);
      expect(result.zone).toBe('STANDARD');
    });

    it('should charge €5.99 for exactly 5000g', () => {
      const result = calculateShippingCost(
        [{ ...item, weightGrams: 5000 }],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(5.99);
    });

    it('should be free if subtotal >= €200', () => {
      const result = calculateShippingCost(
        [item],
        '28001',
        250,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(0);
      expect(result.isFree).toBe(true);
    });
  });

  describe('Standard shipping - weight exceeds limit', () => {
    it('should be unavailable for 5001g', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 5001,
            lengthCm: 35,
            widthCm: 24,
            heightCm: 35,
          },
        ],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.price).toBeNull();
      expect(result.reason).toBe('weight_exceeds_limit');
    });

    it('should be unavailable for 10000g', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 10000,
            lengthCm: 35,
            widthCm: 24,
            heightCm: 35,
          },
        ],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('weight_exceeds_limit');
    });
  });

  describe('Standard shipping - dimensions exceed limit', () => {
    it('should be unavailable for 31x20x20 in Tier 1 (exceeds 30x20x20)', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 1500,
            lengthCm: 31,
            widthCm: 20,
            heightCm: 20,
          },
        ],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('dimensions_exceed_limit');
    });

    it('should be available for 31x20x20 with weight 2001g (falls into Tier 2)', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 2001,
            lengthCm: 31,
            widthCm: 20,
            heightCm: 20,
          },
        ],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(5.99);
    });

    it('should be unavailable for 36x24x35 (exceeds all tiers)', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 2000,
            lengthCm: 36,
            widthCm: 24,
            heightCm: 35,
          },
        ],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('dimensions_exceed_limit');
    });
  });

  describe('Canary Islands - Tier 1', () => {
    const item: ShippingItem = {
      quantity: 1,
      weightGrams: 1500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 20,
    };

    it('should charge €10.99 for 35001 (Gran Canaria)', () => {
      const result = calculateShippingCost(
        [item],
        '35001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(10.99);
      expect(result.zone).toBe('CANARY');
      expect(result.isFree).toBe(false);
    });

    it('should charge €10.99 for 38001 (Tenerife)', () => {
      const result = calculateShippingCost(
        [item],
        '38001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(10.99);
      expect(result.zone).toBe('CANARY');
    });

    it('should NOT apply free shipping even if subtotal >= €200', () => {
      const result = calculateShippingCost(
        [item],
        '35001',
        250, // >= free-shipping threshold
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(10.99);
      expect(result.isFree).toBe(false);
    });
  });

  describe('Canary Islands - Tier 2', () => {
    const item: ShippingItem = {
      quantity: 1,
      weightGrams: 2001,
      lengthCm: 35,
      widthCm: 24,
      heightCm: 35,
    };

    it('should charge €14.99 for 35001 (Gran Canaria)', () => {
      const result = calculateShippingCost(
        [item],
        '35001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(14.99);
      expect(result.zone).toBe('CANARY');
    });

    it('should charge €14.99 for 38001 (Tenerife)', () => {
      const result = calculateShippingCost(
        [item],
        '38001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(14.99);
      expect(result.zone).toBe('CANARY');
    });

    it('should NOT apply free shipping even if subtotal >= €200', () => {
      const result = calculateShippingCost(
        [item],
        '38001',
        300, // >> free-shipping threshold
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(14.99);
      expect(result.isFree).toBe(false);
    });
  });

  describe('Canary Islands - unsupported dimensions/weight', () => {
    it('should be unavailable for > 5kg on Canary', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 5001,
            lengthCm: 35,
            widthCm: 24,
            heightCm: 35,
          },
        ],
        '35001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('weight_exceeds_limit');
    });

    it('should be unavailable for dimensions > 35x24x35 on Canary', () => {
      const result = calculateShippingCost(
        [
          {
            quantity: 1,
            weightGrams: 2000,
            lengthCm: 36,
            widthCm: 24,
            heightCm: 35,
          },
        ],
        '35001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('dimensions_exceed_limit');
    });
  });

  describe('Multiple items and quantities', () => {
    it('should aggregate weight correctly for multiple items', () => {
      const items: ShippingItem[] = [
        { quantity: 2, weightGrams: 800, lengthCm: 20, widthCm: 15, heightCm: 10 },
        { quantity: 1, weightGrams: 400, lengthCm: 20, widthCm: 15, heightCm: 10 },
      ];
      const result = calculateShippingCost(
        items,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      // Total weight: 2*800 + 1*400 = 2000g (exactly Tier 1 limit)
      expect(result.available).toBe(true);
      expect(result.totalWeightGrams).toBe(2000);
      expect(result.price).toBe(4.99);
    });

    it('should move to Tier 2 when total exceeds 2kg', () => {
      const items: ShippingItem[] = [
        { quantity: 3, weightGrams: 800, lengthCm: 20, widthCm: 15, heightCm: 10 },
      ];
      const result = calculateShippingCost(
        items,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      // Total: 3*800 = 2400g (exceeds Tier 1, fits Tier 2)
      expect(result.available).toBe(true);
      expect(result.totalWeightGrams).toBe(2400);
      expect(result.price).toBe(5.99);
    });

    it('should calculate package dimensions correctly with stacking', () => {
      const items: ShippingItem[] = [
        { quantity: 2, weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 5 },
      ];
      const result = calculateShippingCost(
        items,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      // Dimensions: 20 x 15 x (5*2=10) = 20x15x10
      expect(result.packageLengthCm).toBe(20);
      expect(result.packageWidthCm).toBe(15);
      expect(result.packageHeightCm).toBe(10);
    });
  });

  describe('Missing shipping data', () => {
    it('should return unavailable if any item is missing weight', () => {
      const items: ShippingItem[] = [
        { quantity: 1, weightGrams: 1000, lengthCm: 20, widthCm: 15, heightCm: 10 },
        { quantity: 1, weightGrams: null, lengthCm: 20, widthCm: 15, heightCm: 10 },
      ];
      const result = calculateShippingCost(
        items,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('missing_shipping_data');
    });

    it('should return unavailable if any item is missing dimensions', () => {
      const items: ShippingItem[] = [
        { quantity: 1, weightGrams: 1000, lengthCm: 20, widthCm: 15, heightCm: 10 },
        { quantity: 1, weightGrams: 1000, lengthCm: null, widthCm: 15, heightCm: 10 },
      ];
      const result = calculateShippingCost(
        items,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('missing_shipping_data');
    });

    it('should return unavailable for empty order', () => {
      const result = calculateShippingCost(
        [],
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(false);
      expect(result.reason).toBe('empty_order');
    });
  });

  describe('Edge cases', () => {
    it('should handle Decimal values (from Prisma)', () => {
      // Simulate Prisma Decimal type
      const items: ShippingItem[] = [
        {
          quantity: 1,
          weightGrams: 1500,
          lengthCm: { toNumber: () => 30 },
          widthCm: { toNumber: () => 20 },
          heightCm: { toNumber: () => 20 },
        } as any,
      ];
      const result = calculateShippingCost(
        items,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      expect(result.available).toBe(true);
      expect(result.price).toBe(4.99);
    });

    it('should handle dimension normalization correctly', () => {
      // Dimensions in different order should result in same pricing
      const items1: ShippingItem[] = [
        { quantity: 1, weightGrams: 1500, lengthCm: 30, widthCm: 20, heightCm: 20 },
      ];
      const items2: ShippingItem[] = [
        { quantity: 1, weightGrams: 1500, lengthCm: 20, widthCm: 30, heightCm: 20 },
      ];
      const items3: ShippingItem[] = [
        { quantity: 1, weightGrams: 1500, lengthCm: 20, widthCm: 20, heightCm: 30 },
      ];

      const result1 = calculateShippingCost(
        items1,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      const result2 = calculateShippingCost(
        items2,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );
      const result3 = calculateShippingCost(
        items3,
        '28001',
        100,
        FREE_SHIPPING_THRESHOLD
      );

      expect(result1.price).toBe(result2.price);
      expect(result2.price).toBe(result3.price);
      expect(result1.price).toBe(4.99);
    });
  });
});
