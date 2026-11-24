/**
 * POST /api/admin/b2b/orders/[id]/reject
 *
 * Reject a PENDING order. Body (optional): { reason?: string }.
 * No document is issued; the reason is shown to the customer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { rejectB2bOrder } from '@/lib/b2b/orders';
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
    const order = await rejectB2bOrder(id, getAdminActor(), optionalString(body.reason, 1000));
    return NextResponse.json({ success: true, order: { id: order.id, status: order.status } });
  } catch (err) {
    return b2bErrorResponse(err, 'reject_order', { orderId: id });
  }
}
