/**
 * POST /api/b2b/orders/[id]/cancel
 *
 * Cancels one of the customer's own orders. Allowed while the order is
 * PENDING or ACCEPTED. PAID / CANCELLED / REJECTED orders return 409.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { getActiveB2bCustomer } from '@/lib/b2b/session';
import { sendB2bOrderCancelledEmail } from '@/lib/b2b/emails';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const order = await db.b2bOrder.findUnique({ where: { id } });
  if (!order || order.customerId !== customer.id) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
  }

  if (order.status !== 'PENDING' && order.status !== 'ACCEPTED') {
    return NextResponse.json(
      {
        error:
          order.status === 'PAID'
            ? 'No es posible cancelar un pedido ya pagado.'
            : 'Este pedido ya no puede cancelarse.',
      },
      { status: 409 }
    );
  }

  try {
    const updated = await db.b2bOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: 'customer',
      },
    });

    void sendB2bOrderCancelledEmail({
      orderNumber: updated.orderNumber,
      customerCompany: customer.companyName,
      customerEmail: customer.email,
      cancelledBy: 'customer',
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'cancel_email' },
        extra: { orderId: id },
      });
    });

    return NextResponse.json({ success: true, order: { id: updated.id, status: updated.status } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cancelar el pedido.' },
      { status: 500 }
    );
  }
}
