import { describe, expect, it } from 'vitest';
import { calculateSubtotal, getFreeShippingState } from './free-shipping';

describe('free shipping calculations', () => {
  it('handles empty cart', () => {
    const subtotal = calculateSubtotal([]);
    const state = getFreeShippingState(subtotal, 75, 6.95);

    expect(subtotal).toBe(0);
    expect(state.qualified).toBe(false);
    expect(state.remainingAmount).toBe(75);
    expect(state.percentage).toBe(0);
    expect(state.shippingCost).toBe(6.95);
  });

  it('handles cart below threshold', () => {
    const subtotal = calculateSubtotal([
      { price: 25, quantity: 1 },
      { price: 15, quantity: 2 },
    ]);
    const state = getFreeShippingState(subtotal, 75, 6.95);

    expect(subtotal).toBe(55);
    expect(state.qualified).toBe(false);
    expect(state.remainingAmount).toBe(20);
    expect(Math.round(state.percentage)).toBe(73);
    expect(state.shippingCost).toBe(6.95);
  });

  it('handles cart exactly at threshold', () => {
    const subtotal = calculateSubtotal([
      { price: 25, quantity: 3 },
    ]);
    const state = getFreeShippingState(subtotal, 75, 6.95);

    expect(subtotal).toBe(75);
    expect(state.qualified).toBe(true);
    expect(state.remainingAmount).toBe(0);
    expect(state.percentage).toBe(100);
    expect(state.shippingCost).toBe(0);
  });

  it('handles cart above threshold', () => {
    const subtotal = calculateSubtotal([
      { price: 60, quantity: 2 },
    ]);
    const state = getFreeShippingState(subtotal, 75, 6.95);

    expect(subtotal).toBe(120);
    expect(state.qualified).toBe(true);
    expect(state.remainingAmount).toBe(0);
    expect(state.percentage).toBe(100);
    expect(state.shippingCost).toBe(0);
  });

  it('recalculates correctly when quantity changes', () => {
    const baseItems = [{ price: 20, quantity: 1 }];
    const updatedItems = [{ price: 20, quantity: 3 }];

    const subtotalBefore = calculateSubtotal(baseItems);
    const subtotalAfter = calculateSubtotal(updatedItems);
    const stateAfter = getFreeShippingState(subtotalAfter, 75, 6.95);

    expect(subtotalBefore).toBe(20);
    expect(subtotalAfter).toBe(60);
    expect(stateAfter.remainingAmount).toBe(15);
    expect(stateAfter.qualified).toBe(false);
  });

  it('recalculates correctly when product is removed', () => {
    const withTwoProducts = [
      { price: 30, quantity: 1 },
      { price: 25, quantity: 2 },
    ];
    const afterRemoval = [{ price: 30, quantity: 1 }];

    const subtotalBefore = calculateSubtotal(withTwoProducts);
    const subtotalAfter = calculateSubtotal(afterRemoval);
    const stateAfter = getFreeShippingState(subtotalAfter, 75, 6.95);

    expect(subtotalBefore).toBe(80);
    expect(subtotalAfter).toBe(30);
    expect(stateAfter.remainingAmount).toBe(45);
    expect(stateAfter.qualified).toBe(false);
  });

  it('keeps checkout shipping calculation aligned with shared rule', () => {
    const checkoutItems = [
      { price: 40, quantity: 1, discountPercentage: 10 },
      { price: 30, quantity: 1 },
    ];

    const subtotal = calculateSubtotal(checkoutItems);
    const state = getFreeShippingState(subtotal, 75, 6.95);

    expect(subtotal).toBe(66);
    expect(state.shippingCost).toBe(6.95);
    expect(state.qualified).toBe(false);
  });
});
