/**
 * POST /api/admin/b2b/orders/[id]/accept
 *
 * Confirms a PENDING order (customer request or admin quotation).
 * Body (optional): {
 *   generateInvoice?: boolean = false,
 *   invoiceNumber?: string   (required when generateInvoice — invoices are always numbered manually),
 *   notifyCustomer?: boolean = true
 * }
 *
 *   1. Validate the invoice number (format + not already used) BEFORE
 *      confirming, so a bad number never leaves a half-done acceptance.
 *   2. Lifecycle PENDING → ACCEPTED (+ audit event), committed first.
 *   3. If requested, issue the final invoice through the document service
 *      (PDF stored in the private bucket). A generation failure never
 *      reverts the acceptance; the admin can retry from the order detail.
 *   4. If the invoice was issued, email it to the customer (failures are
 *      recorded in the audit trail, never rolled back).
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { acceptB2bOrder } from '@/lib/b2b/orders';
import { issueB2bDocument } from '@/lib/b2b/documents';
import { sendB2bOrderAcceptedEmail } from '@/lib/b2b/emails';
import { recordB2bOrderEventSafe } from '@/lib/b2b/audit';
import { readOrderItems } from '@/lib/b2b/snapshots';
import { B2B_INVOICE_VALIDITY_HOURS } from '@/lib/b2b/company';
import { normalizeManualDocumentNumber } from '@/lib/b2b/order-numbers';
import { B2bServiceError, b2bErrorResponse, readJsonBody } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const generateInvoice = body.generateInvoice === true;
  const notifyCustomer = body.notifyCustomer !== false;
  const actor = getAdminActor();

  let invoiceNumber: string | null = null;
  if (generateInvoice) {
    const manual = normalizeManualDocumentNumber(body.invoiceNumber);
    if (!manual) {
      return NextResponse.json(
        { error: 'Introduce el número de factura: las facturas siempre se numeran manualmente.' },
        { status: 400 }
      );
    }
    if ('error' in manual) return NextResponse.json({ error: manual.error }, { status: 400 });
    if (await db.b2bDocument.findUnique({ where: { number: manual.number }, select: { id: true } })) {
      return NextResponse.json(
        { error: `El número ${manual.number} ya está asignado a otro documento.` },
        { status: 409 }
      );
    }
    invoiceNumber = manual.number;
  }

  let order;
  try {
    order = await acceptB2bOrder(id, actor);
  } catch (err) {
    return b2bErrorResponse(err, 'accept_order', { orderId: id });
  }

  const result = {
    success: true,
    order: { id: order.id, status: order.status },
    document: null as null | { id: string | null; number: string | null; status: string; error: string | null },
    email: null as null | { sent: boolean; error: string | null },
  };
  if (!generateInvoice) return NextResponse.json(result);

  try {
    const outcome = await issueB2bDocument({ orderId: order.id, type: 'INVOICE', actor, manualNumber: invoiceNumber });
    result.document = {
      id: outcome.document.id,
      number: outcome.document.number,
      status: outcome.document.status,
      error: outcome.error,
    };

    if (outcome.issued && outcome.pdf && notifyCustomer) {
      try {
        await sendB2bOrderAcceptedEmail({
          ctx: {
            orderNumber: order.orderNumber,
            customerCompany: order.customer.companyName,
            customerEmail: order.customer.email,
            contactName: order.customer.contactName,
            items: readOrderItems(order.items),
            subtotal: Number(order.subtotal),
            ivaAmount: Number(order.ivaAmount),
            shippingCost: Number(order.shippingCost),
            surchargeRate: Number(order.surchargeRate),
            surchargeAmount: Number(order.surchargeAmount),
            total: Number(order.total),
          },
          invoiceNumber: outcome.document.number,
          invoicePdf: outcome.pdf,
          invoiceValidityHours: B2B_INVOICE_VALIDITY_HOURS,
        });
        result.email = { sent: true, error: null };
        await recordB2bOrderEventSafe(order.id, 'DOCUMENT_EMAIL_SENT', actor, {
          documentId: outcome.document.id,
          number: outcome.document.number,
          to: order.customer.email,
        });
      } catch (err) {
        const error = `No se pudo enviar el email (${err instanceof Error ? err.name : 'Error'}).`;
        result.email = { sent: false, error };
        Sentry.captureException(err, { tags: { module: 'b2b', action: 'accept_email' }, extra: { orderId: id } });
        await recordB2bOrderEventSafe(order.id, 'DOCUMENT_EMAIL_FAILED', actor, {
          documentId: outcome.document.id,
          number: outcome.document.number,
          error,
        });
      }
    }
  } catch (err) {
    if (!(err instanceof B2bServiceError)) {
      Sentry.captureException(err, { tags: { module: 'b2b', action: 'accept_invoice' }, extra: { orderId: id } });
    }
    result.document = {
      id: null,
      number: null,
      status: 'FAILED',
      error: err instanceof B2bServiceError ? err.message : 'No se pudo generar la factura.',
    };
  }

  return NextResponse.json(result);
}
