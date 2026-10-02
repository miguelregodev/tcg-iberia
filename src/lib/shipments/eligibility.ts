/**
 * Pure eligibility rules for the "Agrupar Envío" (grouped shipping) feature.
 * Kept free of DB access so they're unit-testable and reusable by both the
 * order-history UI (client-safe subset) and the server-side request route.
 */

export type ShippingModeValue = 'IMMEDIATE' | 'GROUPED';
export type OrderStatusValue = 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'DEVUELTO';
export type PaymentStatusValue = 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED';

export interface GroupableOrder {
  shippingMode: ShippingModeValue;
  paymentStatus: PaymentStatusValue;
  status: OrderStatusValue;
  shipmentId: string | null;
}

/**
 * An order can be requested for shipment (alone or consolidated) only when it was
 * placed with "Agrupar Envío", has been paid, is still awaiting fulfillment, and
 * isn't already claimed by another shipment.
 */
export function isOrderEligibleForShipmentRequest(order: GroupableOrder): boolean {
  return (
    order.shippingMode === 'GROUPED' &&
    order.paymentStatus === 'PAID' &&
    order.status === 'PROCESSING' &&
    order.shipmentId === null
  );
}

export interface AddressedOrder {
  shippingAddress: string;
  shippingPostalCode: string;
}

/** A consolidated shipment can only go to a single physical address. */
export function haveSameShippingAddress(orders: AddressedOrder[]): boolean {
  if (orders.length <= 1) return true;
  const [first, ...rest] = orders;
  const normalize = (s: string) => s.trim().toLowerCase();
  return rest.every(
    (o) =>
      o.shippingPostalCode === first.shippingPostalCode &&
      normalize(o.shippingAddress) === normalize(first.shippingAddress)
  );
}
