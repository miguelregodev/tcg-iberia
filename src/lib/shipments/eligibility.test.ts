import { describe, expect, it } from 'vitest';
import {
  isOrderEligibleForShipmentRequest,
  haveSameShippingAddress,
  type GroupableOrder,
  type AddressedOrder,
} from './eligibility';

function baseOrder(overrides: Partial<GroupableOrder> = {}): GroupableOrder {
  return {
    shippingMode: 'GROUPED',
    paymentStatus: 'PAID',
    status: 'PROCESSING',
    shipmentId: null,
    ...overrides,
  };
}

describe('isOrderEligibleForShipmentRequest', () => {
  it('is eligible when grouped, paid, processing and unclaimed', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder())).toBe(true);
  });

  it('rejects orders placed with immediate shipping', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder({ shippingMode: 'IMMEDIATE' }))).toBe(false);
  });

  it('rejects unpaid orders', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder({ paymentStatus: 'PENDING_PAYMENT' }))).toBe(false);
  });

  it('rejects already-shipped orders', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder({ status: 'SHIPPED' }))).toBe(false);
  });

  it('rejects cancelled orders', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder({ status: 'CANCELLED' }))).toBe(false);
  });

  it('rejects failed orders', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder({ status: 'FAILED' }))).toBe(false);
  });

  it('rejects orders already claimed by another shipment', () => {
    expect(isOrderEligibleForShipmentRequest(baseOrder({ shipmentId: 'shp_1' }))).toBe(false);
  });
});

describe('haveSameShippingAddress', () => {
  const make = (address: string, postalCode: string): AddressedOrder => ({
    shippingAddress: address,
    shippingPostalCode: postalCode,
  });

  it('is true for a single order', () => {
    expect(haveSameShippingAddress([make('Calle Mayor 1', '28001')])).toBe(true);
  });

  it('is true when address and postal code match exactly', () => {
    expect(
      haveSameShippingAddress([make('Calle Mayor 1', '28001'), make('Calle Mayor 1', '28001')])
    ).toBe(true);
  });

  it('ignores case/whitespace differences in the address text', () => {
    expect(
      haveSameShippingAddress([make('Calle Mayor 1', '28001'), make('  calle mayor 1  ', '28001')])
    ).toBe(true);
  });

  it('is false when postal codes differ', () => {
    expect(
      haveSameShippingAddress([make('Calle Mayor 1', '28001'), make('Calle Mayor 1', '08001')])
    ).toBe(false);
  });

  it('is false when the street address differs', () => {
    expect(
      haveSameShippingAddress([make('Calle Mayor 1', '28001'), make('Calle Mayor 2', '28001')])
    ).toBe(false);
  });
});
