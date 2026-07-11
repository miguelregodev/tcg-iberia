/**
 * POST /api/admin/b2b/orders/[id]/accept
 *
 * Flip a PENDING order to ACCEPTED:
 *   1. Reserve a legally sequential invoice number.
 *   2. Persist the number + acceptance timestamp.
 *   3. Generate the PDF invoice.
 *   4. Email the customer with the PDF attached.
 *
 * The invoice number and status flip happen inside the same transaction so
 * the sequence cannot desync from the persisted invoice (Spanish AEAT
 * requires strictly gap-free invoice numbers).
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { generateB2bInvoiceNumber } from '@/lib/b2b/order-numbers';
import { generateInvoicePdf, type InvoiceItem } from '@/lib/b2b/invoice-pdf';
import {
  sendB2bOrderAcceptedEmail,
  type OrderEmailLine,
} from '@/lib/b2b/emails';
import { B2B_INVOICE_VALIDITY_HOURS } from '@/lib/b2b/company';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface StoredItem {
  productId: string;
  variant: 'SHRINK' | 'NO_SHRINK';
  name: string;
  quantity: number;
  unitPriceEur: number;
  lineTotal: number;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const order = await db.b2bOrder.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
  }
  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'El pedido ya no está pendiente.' },
      { status: 409 }
    );
  }

  const now = new Date();
  let updated: typeof order;
  try {
    updated = await db.$transaction(async (tx) => {
      const invoiceNumber = await generateB2bInvoiceNumber(tx);
      const row = await tx.b2bOrder.update({
        where: { id: order.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: now,
          invoicedAt: now,
          invoiceNumber,
        },
        include: { customer: true },
      });
      return row;
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'accept_order' },
      extra: { orderId: id },
    });
    return NextResponse.json(
      { error: 'No se pudo aprobar el pedido.' },
      { status: 500 }
    );
  }

  // ── Post-transaction side effects (PDF + email) ──────────────────────────
  const items = updated.items as unknown as StoredItem[];
  const invoiceItems: InvoiceItem[] = items.map((i) => ({
    name: i.name,
    variant: i.variant,
    quantity: i.quantity,
    unitPriceEur: i.unitPriceEur,
    lineTotal: i.lineTotal,
  }));

  try {
    const pdf = await generateInvoicePdf({
      invoiceNumber: updated.invoiceNumber!,
      orderNumber: updated.orderNumber,
      invoiceDate: updated.invoicedAt ?? now,
      customer: {
        companyName: updated.customer.companyName,
        vatNumber: updated.customer.vatNumber,
        contactName: updated.customer.contactName,
        email: updated.customer.email,
        phone: updated.customer.phone,
        shippingAddress: updated.customer.shippingAddress,
        billingAddress: updated.customer.billingAddress,
      },
      items: invoiceItems,
      subtotal: Number(updated.subtotal),
      ivaAmount: Number(updated.ivaAmount),
      total: Number(updated.total),
    });

    const emailLines: OrderEmailLine[] = items.map((i) => ({
      name: i.name,
      variant: i.variant,
      quantity: i.quantity,
      unitPriceEur: i.unitPriceEur,
      lineTotal: i.lineTotal,
    }));

    await sendB2bOrderAcceptedEmail({
      ctx: {
        orderNumber: updated.orderNumber,
        customerCompany: updated.customer.companyName,
        customerEmail: updated.customer.email,
        contactName: updated.customer.contactName,
        items: emailLines,
        subtotal: Number(updated.subtotal),
        ivaAmount: Number(updated.ivaAmount),
        total: Number(updated.total),
      },
      invoiceNumber: updated.invoiceNumber!,
      invoicePdf: pdf,
      invoiceValidityHours: B2B_INVOICE_VALIDITY_HOURS,
    });
  } catch (err) {
    // Do not roll back the status change on email failure — the invoice
    // number is already committed and legal. The admin can resend the
    // email manually if needed.
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'accept_pdf_or_email' },
      extra: { orderId: id, invoiceNumber: updated.invoiceNumber },
    });
  }

  return NextResponse.json({
    success: true,
    order: {
      id: updated.id,
      status: updated.status,
      invoiceNumber: updated.invoiceNumber,
    },
  });
}
