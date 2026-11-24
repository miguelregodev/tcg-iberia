/**
 * POST /api/b2b/orders/[id]/cancel
 *
 * Cancels one of the customer's own orders while it is still PENDING or
 * ACCEPTED, unpaid and not yet in preparation (see canCancel in
 * src/lib/b2b/order-status.ts). Other orders return 409.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getActiveB2bCustomer } from '@/lib/b2b/session';
import { sendB2bOrderCancelledEmail } from '@/lib/b2b/emails';
import { cancelB2bOrder } from '@/lib/b2b/orders';
import { CUSTOMER_ACTOR } from '@/lib/b2b/audit';
import { b2bErrorResponse } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    const { order } = await cancelB2bOrder({
      orderId: id,
      actor: CUSTOMER_ACTOR,
      by: 'customer',
      reason: null,
      customerId: customer.id,
    });

    void sendB2bOrderCancelledEmail({
      orderNumber: order.orderNumber,
      customerCompany: customer.companyName,
      customerEmail: customer.email,
      cancelledBy: 'customer',
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'cancel_email' },
        extra: { orderId: id },
      });
    });

    return NextResponse.json({ success: true, order: { id: order.id, status: order.status } });
  } catch (err) {
    return b2bErrorResponse(err, 'customer_cancel_order', { orderId: id });
  }
}
