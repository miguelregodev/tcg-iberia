/**
 * GET  /api/admin/b2b/orders
 * POST /api/admin/b2b/orders
 *
 * GET — Server-side filtered, sorted and paginated list of every B2B order
 *       (customer- and admin-created). Query params (all optional):
 *         q, email, company, vat, orderNumber,
 *         status, paymentStatus, fulfillmentStatus, source,
 *         invoice=issued|none|failed, from=YYYY-MM-DD, to=YYYY-MM-DD,
 *         sort=createdAt|total|status|paymentStatus|fulfillmentStatus, dir=asc|desc,
 *         page, pageSize (≤ 100)
 *
 * POST — Manually create an order on behalf of a B2B customer.
 *   Body: {
 *     customerId, items: [{ productId, quantity, discountPercent? }],
 *     shippingCost?, notes? (customer-visible), internalNotes?,
 *     document: 'NONE' | 'INVOICE' | 'PROFORMA' | 'QUOTATION',
 *     documentNumber?: string  (required for INVOICE — invoices are always numbered
 *                               manually; optional override for PROFORMA/QUOTATION),
 *     notifyCustomer?: boolean, idempotencyKey: string
 *   }
 *   Prices/VAT/totals are computed server-side. QUOTATION orders start as
 *   PENDING (awaiting confirmation); the rest start ACCEPTED. The order is
 *   committed before any document is generated: a document failure never
 *   loses the order and is reported so the admin can retry it.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { parseAdminOrderFilters } from '@/lib/b2b/admin-order-filters';
import { createB2bOrder, listAdminB2bOrders, resolveB2bOrderUrl } from '@/lib/b2b/orders';
import { emailB2bDocument, issueB2bDocument } from '@/lib/b2b/documents';
import { parseOrderLines, parseShippingCost } from '@/lib/b2b/pricing';
import { B2bServiceError, b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';
import { normalizeManualDocumentNumber } from '@/lib/b2b/order-numbers';

const DOCUMENT_OPTIONS = ['NONE', 'INVOICE', 'PROFORMA', 'QUOTATION'] as const;
type DocumentOption = (typeof DOCUMENT_OPTIONS)[number];

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await listAdminB2bOrders(parseAdminOrderFilters(new URL(request.url).searchParams));
    return NextResponse.json(result);
  } catch (err) {
    return b2bErrorResponse(err, 'admin_list_orders');
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const actor = getAdminActor();
  const body = await readJsonBody(request);

  const customerId = optionalString(body.customerId, 64);
  if (!customerId) {
    return NextResponse.json({ error: 'Selecciona un cliente B2B.' }, { status: 400 });
  }
  const document = (body.document ?? 'NONE') as DocumentOption;
  if (!DOCUMENT_OPTIONS.includes(document)) {
    return NextResponse.json({ error: 'Tipo de documento no válido.' }, { status: 400 });
  }
  const idempotencyKey = optionalString(body.idempotencyKey, 100);
  if (!idempotencyKey || !/^[A-Za-z0-9-]{16,100}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: 'Falta una clave de idempotencia válida.' }, { status: 400 });
  }
  const { lines, errors } = parseOrderLines(body.items, { strict: true, allowDiscount: true });
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(' '), errors }, { status: 400 });
  }
  const shipping = parseShippingCost(body.shippingCost);
  if ('error' in shipping) {
    return NextResponse.json({ error: shipping.error }, { status: 400 });
  }
  const manual = document === 'NONE' ? null : normalizeManualDocumentNumber(body.documentNumber);
  if (manual && 'error' in manual) {
    return NextResponse.json({ error: manual.error }, { status: 400 });
  }
  const manualNumber = manual?.number ?? null;
  if (document === 'INVOICE' && !manualNumber) {
    return NextResponse.json(
      { error: 'Introduce el número de factura: las facturas siempre se numeran manualmente.' },
      { status: 400 }
    );
  }

  const customer = await db.b2bCustomer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: 'Cliente B2B no encontrado.' }, { status: 404 });
  }
  if (customer.status === 'DISABLED') {
    return NextResponse.json(
      { error: 'El cliente está desactivado. Reactívalo antes de crear pedidos.' },
      { status: 409 }
    );
  }
  if (manualNumber && (await db.b2bDocument.findUnique({ where: { number: manualNumber }, select: { id: true } }))) {
    return NextResponse.json(
      { error: `El número ${manualNumber} ya está asignado a otro documento.` },
      { status: 409 }
    );
  }

  let created;
  try {
    created = await createB2bOrder({
      customer,
      lines,
      shippingCostCents: shipping.cents,
      notes: optionalString(body.notes, 2000),
      internalNotes: optionalString(body.internalNotes, 5000),
      source: 'ADMIN',
      actor,
      idempotencyKey,
      initialStatus: document === 'QUOTATION' ? 'PENDING' : 'ACCEPTED',
      rejectOnUnpricedLines: true,
    });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_create_order', { customerId });
  }

  const { order, duplicate } = created;
  const response = {
    success: true,
    duplicate,
    order: { id: order.id, orderNumber: order.orderNumber, total: Number(order.total) },
    document: null as null | { id: string | null; number: string | null; status: string; error: string | null },
    email: null as null | { sent: boolean; error: string | null },
  };
  if (duplicate || document === 'NONE') {
    return NextResponse.json(response, { status: duplicate ? 200 : 201 });
  }

  try {
    const outcome = await issueB2bDocument({ orderId: order.id, type: document, actor, manualNumber });
    response.document = {
      id: outcome.document.id,
      number: outcome.document.number,
      status: outcome.document.status,
      error: outcome.error,
    };
    if (outcome.issued && body.notifyCustomer === true) {
      response.email = await emailB2bDocument({
        orderId: order.id,
        documentId: outcome.document.id,
        actor,
        orderUrl: resolveB2bOrderUrl(request.nextUrl.origin, order.id),
        pdf: outcome.pdf,
      });
    }
  } catch (err) {
    // The order is already committed; report the document problem so it can be retried.
    if (!(err instanceof B2bServiceError)) {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'admin_create_order_document' },
        extra: { orderId: order.id },
      });
    }
    response.document = {
      id: null,
      number: null,
      status: 'FAILED',
      error: err instanceof B2bServiceError ? err.message : 'No se pudo generar el documento.',
    };
  }

  return NextResponse.json(response, { status: 201 });
}
