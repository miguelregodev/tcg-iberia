/**
 * POST /api/b2b/orders
 * GET  /api/b2b/orders?page=1&pageSize=10
 *
 * POST — Create a new B2B order request from the current cart.
 *        Requires an ACTIVE B2B session. Prices are re-fetched from the
 *        database (never trust client-supplied prices) and the VAT breakdown
 *        is computed server-side by the shared pricing service. An optional
 *        `idempotencyKey` makes retries safe. On success the sales team gets
 *        an email + the customer gets a copy.
 *
 * GET  — Paginated list of the current customer's own orders (most recent
 *        first). Internal notes / audit data are never included.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getActiveB2bCustomer } from '@/lib/b2b/session';
import { sendB2bOrderRequestEmail } from '@/lib/b2b/emails';
import { truncate } from '@/lib/b2b/validation';
import { parseOrderLines } from '@/lib/b2b/pricing';
import { createB2bOrder, listCustomerB2bOrders } from '@/lib/b2b/orders';
import { CUSTOMER_ACTOR } from '@/lib/b2b/audit';
import { B2bServiceError, b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

// ── GET: list current customer's orders ────────────────────────────────────
export async function GET(request: NextRequest) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10));

  try {
    const result = await listCustomerB2bOrders(customer.id, page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    return b2bErrorResponse(err, 'list_customer_orders', { customerId: customer.id });
  }
}

// ── POST: create order from cart ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const { lines, errors } = parseOrderLines(body.items, { strict: false, allowDiscount: false });
  if (lines.length === 0) {
    return NextResponse.json({ error: errors[0] ?? 'El carrito está vacío.' }, { status: 400 });
  }
  const notes = truncate(typeof body.notes === 'string' ? body.notes : null, 2000);

  try {
    const { order, pricing, duplicate } = await createB2bOrder({
      customer,
      lines,
      shippingCostCents: 0,
      notes,
      internalNotes: null,
      source: 'CUSTOMER',
      actor: CUSTOMER_ACTOR,
      idempotencyKey: optionalString(body.idempotencyKey, 100),
      initialStatus: 'PENDING',
      rejectOnUnpricedLines: false,
    });

    if (!duplicate) {
      void sendB2bOrderRequestEmail({
        orderNumber: order.orderNumber,
        customerCompany: customer.companyName,
        customerEmail: customer.email,
        contactName: customer.contactName,
        items: pricing.items,
        subtotal: pricing.subtotal,
        ivaAmount: pricing.ivaAmount,
        surchargeRate: pricing.surchargeRate,
        surchargeAmount: pricing.surchargeAmount,
        total: pricing.total,
        notes,
      }).catch((err) => {
        Sentry.captureException(err, {
          tags: { module: 'b2b', action: 'order_request_email' },
          extra: { orderId: order.id },
        });
      });
    }

    return NextResponse.json({
      success: true,
      duplicate,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: pricing.subtotal,
        ivaAmount: pricing.ivaAmount,
        surchargeAmount: pricing.surchargeAmount,
        total: pricing.total,
      },
      rejections: pricing.rejections.length > 0 ? pricing.rejections : undefined,
    });
  } catch (err) {
    if (err instanceof B2bServiceError) return b2bErrorResponse(err, 'create_order');
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'create_order' },
      extra: { customerId: customer.id },
    });
    return NextResponse.json({ error: 'No se pudo registrar el pedido.' }, { status: 500 });
  }
}
