/**
 * POST /api/admin/b2b/orders/[id]/cancel
 *
 * Admin cancellation. Body (optional): { reason?: string }.
 * Fulfillment becomes CANCELLED and a PENDING payment is voided; a PAID
 * payment is left untouched (record a refund explicitly). The response
 * flags whether a refund and/or a corrective invoice are now required.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { cancelB2bOrder } from '@/lib/b2b/orders';
import { sendB2bOrderCancelledEmail } from '@/lib/b2b/emails';
import { b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await readJsonBody(request);

  try {
    const result = await cancelB2bOrder({
      orderId: id,
      actor: getAdminActor(),
      by: 'admin',
      reason: optionalString(body.reason, 1000),
    });

    void sendB2bOrderCancelledEmail({
      orderNumber: result.order.orderNumber,
      customerCompany: result.order.customer.companyName,
      customerEmail: result.order.customer.email,
      cancelledBy: 'admin',
    }).catch((err) => {
      Sentry.captureException(err, { tags: { module: 'b2b', action: 'cancel_email' }, extra: { orderId: id } });
    });

    return NextResponse.json({
      success: true,
      requiresRefund: result.requiresRefund,
      requiresCorrectiveInvoice: result.requiresCorrectiveInvoice,
    });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_cancel_order', { orderId: id });
  }
}
