/**
 * POST /api/admin/b2b/orders/[id]/fulfillment
 *
 * Body: {
 *   status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'RETURNED',
 *   trackingNumber?: string, shippingProvider?: 'CORREOS'|'MRW'|'SEUR'|'CTT_EXPRESS',
 *   reason?: string  (return reason)
 * }
 *
 * SHIPPED requires a tracking number and a carrier (same carriers as the B2C
 * order system). On the first transition to SHIPPED the customer is emailed
 * AFTER the change is committed; an email failure is recorded and never
 * rolls the shipment back (retry via /shipping-email). Sending SHIPPED for an
 * already-shipped order updates the tracking data without re-notifying.
 * Returns never modify the payment status.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2bFulfillmentStatus } from '@prisma/client';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import {
  resolveB2bOrderUrl,
  sendB2bShippingNotification,
  updateB2bFulfillment,
} from '@/lib/b2b/orders';
import { b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

const STATUSES: readonly B2bFulfillmentStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const status = body.status as B2bFulfillmentStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado de envío no válido.' }, { status: 400 });
  }
  const actor = getAdminActor();

  let result;
  try {
    result = await updateB2bFulfillment({
      orderId: id,
      actor,
      status,
      trackingNumber: optionalString(body.trackingNumber, 100),
      shippingProvider: optionalString(body.shippingProvider, 20),
      reason: optionalString(body.reason, 1000),
    });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_update_fulfillment', { orderId: id });
  }

  let email: { sent: boolean; error: string | null } | null = null;
  if (result.shouldNotify) {
    try {
      email = await sendB2bShippingNotification({
        orderId: id,
        actor,
        orderUrl: resolveB2bOrderUrl(request.nextUrl.origin, id),
        isRetry: false,
      });
    } catch {
      email = { sent: false, error: 'No se pudo enviar el email de envío.' };
    }
  }

  return NextResponse.json({
    success: true,
    order: { id: result.order.id, fulfillmentStatus: result.order.fulfillmentStatus },
    email,
  });
}
