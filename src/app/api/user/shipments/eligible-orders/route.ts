import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/user/shipments/eligible-orders
 *
 * Returns the authenticated customer's own orders that are currently eligible to be
 * requested for shipment (alone or consolidated with each other) — i.e. "Agrupar
 * Envío" orders that are paid, still awaiting fulfillment, and not already claimed
 * by another shipment. Used to build the "Agrupar pedidos" confirmation screen.
 *
 * Eligibility is enforced entirely in the `where` clause below; see
 * `isOrderEligibleForShipmentRequest` in src/lib/shipments/eligibility.ts for the same
 * rule expressed as a pure function (used by /api/user/shipments/request).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const orders = await db.order.findMany({
      where: {
        userId: session.user.id,
        shippingMode: 'GROUPED',
        paymentStatus: 'PAID',
        status: 'PROCESSING',
        shipmentId: null,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        shippingAddress: true,
        shippingPostalCode: true,
        shippingCity: true,
        createdAt: true,
      },
    });

    const mapped = orders.map((o) => ({
      ...o,
      totalAmount: parseFloat(o.totalAmount.toString()),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/shipments/eligible-orders' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
