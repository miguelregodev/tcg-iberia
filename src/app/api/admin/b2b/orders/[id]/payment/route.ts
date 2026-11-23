/**
 * POST /api/admin/b2b/orders/[id]/payment
 *
 * Body: {
 *   status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED',
 *   method?: string, reference?: string, paidAt?: 'YYYY-MM-DD' | ISO date
 * }
 * Transitions are validated by canChangePayment(); payment changes never
 * alter the lifecycle or fulfillment status.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2bPaymentStatus } from '@prisma/client';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { updateB2bPaymentStatus } from '@/lib/b2b/orders';
import { b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

const STATUSES: readonly B2bPaymentStatus[] = ['PENDING', 'PAID', 'REFUNDED', 'CANCELLED'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await readJsonBody(request);

  const status = body.status as B2bPaymentStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado de pago no válido.' }, { status: 400 });
  }
  let paidAt: Date | null = null;
  const rawPaidAt = optionalString(body.paidAt, 40);
  if (rawPaidAt) {
    paidAt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawPaidAt) ? `${rawPaidAt}T12:00:00.000Z` : rawPaidAt);
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: 'Fecha de pago no válida.' }, { status: 400 });
    }
  }

  try {
    const order = await updateB2bPaymentStatus({
      orderId: id,
      actor: getAdminActor(),
      status,
      method: optionalString(body.method, 60),
      reference: optionalString(body.reference, 120),
      paidAt,
    });
    return NextResponse.json({
      success: true,
      order: { id: order.id, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus },
    });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_update_payment', { orderId: id });
  }
}
