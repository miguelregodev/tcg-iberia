import 'server-only';

import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { sendShipmentRequestAdminNotification } from '@/lib/email';
import { getOrderItemVariant } from '@/lib/orders/items';

interface OrderItemSnapshot {
  id?: string;
  name?: string;
  quantity?: number;
  price?: number;
  discountPercentage?: number;
}

/**
 * Emails sales about a grouped-shipment request. Call only once the request is final:
 * immediately for free shipments, or after Redsys confirms the shipping fee. Never throws.
 */
export async function notifyShipmentRequested(shipmentId: string): Promise<void> {
  try {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: { orders: { orderBy: { createdAt: 'asc' } } },
    });

    if (!shipment || shipment.orders.length === 0) return;

    const referenceOrder = shipment.orders[0];
    const shippingCost = parseFloat(shipment.shippingCost.toString());

    await sendShipmentRequestAdminNotification({
      shipmentNumber: shipment.shipmentNumber,
      fullName: referenceOrder.fullName,
      email: referenceOrder.email,
      phone: referenceOrder.phone,
      shipping: {
        address: referenceOrder.shippingAddress,
        postalCode: referenceOrder.shippingPostalCode,
        city: referenceOrder.shippingCity,
        locality: referenceOrder.shippingLocality,
        province: referenceOrder.shippingProvince,
      },
      merchandiseTotal: parseFloat(shipment.merchandiseTotal.toString()),
      shippingCost,
      requiresPayment: shippingCost > 0,
      orders: shipment.orders.map((o) => ({
        orderNumber: o.orderNumber,
        totalAmount: parseFloat(o.totalAmount.toString()),
        items: (Array.isArray(o.items) ? (o.items as unknown as OrderItemSnapshot[]) : []).map((item) => ({
          name: item.name || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          discountPercentage: item.discountPercentage,
          variant: getOrderItemVariant(item),
        })),
      })),
    });
  } catch (error) {
    captureServerError({
      error,
      module: 'shipment_request_notification',
      extra: { shipmentId },
    });
  }
}
