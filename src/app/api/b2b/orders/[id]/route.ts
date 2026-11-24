/**
 * GET /api/b2b/orders/[id]
 *
 * Full detail of one of the current customer's orders. Ownership is part of
 * the DB query, so another customer's order ID yields the same 404 as a
 * non-existent one. Internal notes and audit events are never returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveB2bCustomer } from '@/lib/b2b/session';
import { getCustomerB2bOrder } from '@/lib/b2b/orders';
import { b2bErrorResponse } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    const order = await getCustomerB2bOrder(customer.id, id);
    return NextResponse.json({ order });
  } catch (err) {
    return b2bErrorResponse(err, 'customer_order_detail', { orderId: id });
  }
}
