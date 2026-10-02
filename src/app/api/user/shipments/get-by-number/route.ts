import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/user/shipments/get-by-number?number=ENV-...
 *
 * Used by the post-payment return pages. Ownership is enforced server-side — a
 * customer can never query another customer's shipment, even by guessing/crafting
 * the shipment number.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const shipmentNumber = request.nextUrl.searchParams.get('number');
    if (!shipmentNumber) {
      return NextResponse.json({ error: 'Falta el número de envío.' }, { status: 400 });
    }

    const shipment = await db.shipment.findUnique({
      where: { shipmentNumber },
      select: {
        id: true,
        shipmentNumber: true,
        userId: true,
        merchandiseTotal: true,
        shippingCost: true,
        paymentStatus: true,
        orders: { select: { orderNumber: true } },
      },
    });

    if (!shipment || shipment.userId !== session.user.id) {
      return NextResponse.json({ error: 'Envío no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        shipmentNumber: shipment.shipmentNumber,
        merchandiseTotal: parseFloat(shipment.merchandiseTotal.toString()),
        shippingCost: parseFloat(shipment.shippingCost.toString()),
        paymentStatus: shipment.paymentStatus,
        orderNumbers: shipment.orders.map((o) => o.orderNumber),
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/shipments/get-by-number' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
