/**
 * POST /api/user/shipments/[id]/cancel
 *
 * Lets a customer back out of a grouped-shipment request that's still waiting on the
 * shipping-fee payment (e.g. they no longer want to pay now). Releases every order
 * claimed by the shipment (shipmentId -> null) so they revert to their original
 * "En proceso / Pagado / Envío agrupado" state and can be included in a new shipment
 * request later. Ownership is re-verified server-side; never trusts the id alone.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { captureServerError } from '@/lib/observability/sentry';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { id } = await params;
    const shipment = await db.shipment.findUnique({ where: { id } });

    if (!shipment || shipment.userId !== session.user.id) {
      return NextResponse.json({ error: 'Envío no encontrado.' }, { status: 404 });
    }

    if (shipment.paymentStatus !== 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: 'Este envío ya no se puede cancelar.' },
        { status: 409 }
      );
    }

    await db.$transaction([
      db.order.updateMany({
        where: { shipmentId: shipment.id },
        data: { shipmentId: null },
      }),
      db.shipment.update({
        where: { id: shipment.id },
        data: { paymentStatus: 'CANCELLED' },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    captureServerError({ error, module: 'shipments_cancel_api', request });
    return NextResponse.json({ error: 'Error al cancelar la solicitud de envío.' }, { status: 500 });
  }
}
