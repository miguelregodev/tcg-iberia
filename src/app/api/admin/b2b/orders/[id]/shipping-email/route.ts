/**
 * POST /api/admin/b2b/orders/[id]/shipping-email
 *
 * Retries / resends the "order shipped" email for a shipped order (e.g. after
 * an SMTP failure or a tracking correction). Recorded in the audit trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { resolveB2bOrderUrl, sendB2bShippingNotification } from '@/lib/b2b/orders';
import { b2bErrorResponse } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    const result = await sendB2bShippingNotification({
      orderId: id,
      actor: getAdminActor(),
      orderUrl: resolveB2bOrderUrl(request.nextUrl.origin, id),
      isRetry: true,
    });
    return NextResponse.json(result, { status: result.sent ? 200 : 502 });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_retry_shipping_email', { orderId: id });
  }
}
