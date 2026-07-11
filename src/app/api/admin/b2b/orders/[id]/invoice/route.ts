/**
 * GET /api/admin/b2b/orders/[id]/invoice
 *
 * Streams the PDF invoice for an order back to the admin. The PDF is
 * regenerated on demand from the persisted snapshot so we don't need to
 * store the binary anywhere. Only orders that have reached the ACCEPTED
 * status (and therefore hold a legal `invoiceNumber`) can be exported.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { generateInvoicePdf, type InvoiceItem } from '@/lib/b2b/invoice-pdf';

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

export async function GET(request: NextRequest, context: RouteContext) {
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
  if (!order.invoiceNumber || !order.invoicedAt) {
    return NextResponse.json(
      { error: 'Este pedido no tiene factura emitida.' },
      { status: 409 }
    );
  }

  const items = order.items as unknown as StoredItem[];
  const invoiceItems: InvoiceItem[] = items.map((i) => ({
    name: i.name,
    variant: i.variant,
    quantity: i.quantity,
    unitPriceEur: i.unitPriceEur,
    lineTotal: i.lineTotal,
  }));

  const pdf = await generateInvoicePdf({
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    invoiceDate: order.invoicedAt,
    customer: {
      companyName: order.customer.companyName,
      vatNumber: order.customer.vatNumber,
      contactName: order.customer.contactName,
      email: order.customer.email,
      phone: order.customer.phone,
      shippingAddress: order.customer.shippingAddress,
      billingAddress: order.customer.billingAddress,
    },
    items: invoiceItems,
    subtotal: Number(order.subtotal),
    ivaAmount: Number(order.ivaAmount),
    total: Number(order.total),
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${order.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
