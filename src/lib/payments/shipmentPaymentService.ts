/**
 * Payment side-effects for grouped-shipment fee payments.
 *
 * Mirrors the Order payment service (src/lib/payments/paymentService.ts) but scoped
 * to the much smaller Shipment lifecycle: there is no stock to decrement and no order
 * items to email — the Shipment fee payment only confirms that the customer paid the
 * single consolidated shipping charge. The underlying orders were already paid in full
 * at their own checkout.
 */
import 'server-only';

import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { Prisma } from '@prisma/client';
import { notifyShipmentRequested } from '@/lib/shipments/notify';

interface ShipmentPaymentSuccessContext {
  shipmentId: string;
  shipmentNumber: string;
  paymentAmount: number;
  paymentCurrency: string;
  transactionId?: string;
}

interface ShipmentPaymentFailureContext {
  shipmentId: string;
  shipmentNumber: string;
  reason: string;
}

export async function handleShipmentPaymentSuccess(context: ShipmentPaymentSuccessContext) {
  const { shipmentId, paymentAmount, paymentCurrency } = context;

  try {
    let newlyPaid = false;
    const result = await db.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, paymentStatus: true },
      });

      if (!shipment) {
        throw new Error(`Shipment not found: ${shipmentId}`);
      }

      // Idempotent: a retried/duplicate notification must not double-process.
      if (shipment.paymentStatus === 'PAID') {
        return shipment;
      }

      newlyPaid = true;
      return tx.shipment.update({
        where: { id: shipmentId },
        data: {
          paymentStatus: 'PAID',
          paymentPaidAt: new Date(),
        },
      });
    });

    // Fee confirmed by Redsys: only now does sales hear about the request (once).
    if (newlyPaid) {
      await notifyShipmentRequested(shipmentId);
    }

    return result;
  } catch (error) {
    captureServerError({
      error,
      module: 'shipment_payment_success_handler',
      extra: { shipmentId, paymentAmount, paymentCurrency },
    });
    throw error;
  }
}

export async function handleShipmentPaymentFailure(context: ShipmentPaymentFailureContext) {
  const { shipmentId, reason } = context;

  try {
    return await db.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, paymentStatus: true },
      });

      if (!shipment) {
        throw new Error(`Shipment not found: ${shipmentId}`);
      }

      if (shipment.paymentStatus === 'PAYMENT_FAILED') {
        return shipment;
      }

      // Release the claimed orders so the customer can try requesting shipment again.
      await tx.order.updateMany({
        where: { shipmentId },
        data: { shipmentId: null },
      });

      return tx.shipment.update({
        where: { id: shipmentId },
        data: { paymentStatus: 'PAYMENT_FAILED' },
      });
    });
  } catch (error) {
    captureServerError({
      error,
      module: 'shipment_payment_failure_handler',
      extra: { shipmentId, reason },
    });
    throw error;
  }
}

/** Verify the amount Redsys charged matches the shipment's fee exactly (±1 cent for rounding). */
export function verifyShipmentPaymentAmount(
  shipment: { shippingCost: Prisma.Decimal; id: string },
  paymentAmount: number
): void {
  const expectedAmountCents = Math.round(parseFloat(shipment.shippingCost.toString()) * 100);
  const variance = Math.abs(paymentAmount - expectedAmountCents);
  if (variance > 1) {
    throw new Error(
      `Shipment payment amount mismatch: expected ${expectedAmountCents} cents, received ${paymentAmount} cents`
    );
  }
}
