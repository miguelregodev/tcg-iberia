/**
 * POST /api/b2b/orders
 * GET  /api/b2b/orders
 *
 * POST — Create a new B2B order request from the current cart.
 *        Requires an ACTIVE B2B session. Prices are re-fetched from the
 *        database (never trust client-supplied prices) and the actual VAT
 *        breakdown is computed server-side. On success the sales team gets
 *        an email + the customer gets a copy.
 *
 * GET  — List the current B2B customer's own orders (most recent first).
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { getActiveB2bCustomer } from '@/lib/b2b/session';
import { generateB2bOrderNumber } from '@/lib/b2b/order-numbers';
import { sendB2bOrderRequestEmail, type OrderEmailLine } from '@/lib/b2b/emails';
import { B2B_IVA_RATE } from '@/lib/b2b/company';
import { truncate } from '@/lib/b2b/validation';

// ── Types ───────────────────────────────────────────────────────────────────

interface OrderItemInput {
  productId: string;
  variant: 'SHRINK' | 'NO_SHRINK';
  quantity: number;
}

interface PersistedItem extends OrderItemInput {
  name: string;
  unitPriceEur: number;
  lineTotal: number;
}

const MAX_QTY_PER_LINE = 999;
const MAX_LINES = 100;


// ── GET: list current customer's orders ────────────────────────────────────
export async function GET(request: NextRequest) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orders = await db.b2bOrder.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      ivaAmount: true,
      total: true,
      invoiceNumber: true,
      invoicedAt: true,
      acceptedAt: true,
      paidAt: true,
      cancelledAt: true,
      rejectedAt: true,
      items: true,
      notes: true,
      createdAt: true,
    },
  });

  // Serialise decimals to numbers for the browser.
  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      ivaAmount: Number(o.ivaAmount),
      total: Number(o.total),
    })),
  });
}

// ── POST: create order from cart ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  console.log("POST /api/b2b/orders");
  console.log("Creating order from cart with request ...", request);
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { items?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'El carrito está vacío.' },
      { status: 400 }
    );
  }
  if (body.items.length > MAX_LINES) {
    return NextResponse.json(
      { error: `El pedido supera el máximo de ${MAX_LINES} líneas.` },
      { status: 400 }
    );
  }

  // ── Normalise & validate line items ──────────────────────────────────────
  const rawItems: OrderItemInput[] = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const productId = typeof r.productId === 'string' ? r.productId.trim() : '';
    const rawVariant = r.variant;
    const variant: 'SHRINK' | 'NO_SHRINK' =
      rawVariant === 'NO_SHRINK' ? 'NO_SHRINK' : 'SHRINK';
    const quantity =
      typeof r.quantity === 'number' ? Math.floor(r.quantity) : parseInt(String(r.quantity), 10);
    if (!productId) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (quantity > MAX_QTY_PER_LINE) continue;
    rawItems.push({ productId, variant, quantity });
  }

  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: 'Ninguna línea del carrito es válida.' },
      { status: 400 }
    );
  }

  // Merge duplicate (productId, variant) pairs — sum quantities.
  const merged = new Map<string, OrderItemInput>();
  for (const i of rawItems) {
    const k = `${i.productId}:${i.variant}`;
    const prev = merged.get(k);
    merged.set(k, prev ? { ...prev, quantity: prev.quantity + i.quantity } : i);
  }
  const items = Array.from(merged.values());

  // ── Fetch canonical product data ─────────────────────────────────────────
  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: {
      id: true,
      name: true,
      price: true,
      noShrinkPrice: true,
      b2bPrice: true,
      b2bPriceNoShrink: true,
      stock: true,
      noShrinkStock: true,
      visible: true,
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const persisted: PersistedItem[] = [];
  const rejections: Array<{ productId: string; reason: string }> = [];

  for (const line of items) {
    const p = productMap.get(line.productId);
    if (!p || !p.visible) {
      rejections.push({ productId: line.productId, reason: 'unavailable' });
      continue;
    }

    // Choose the correct b2b price for the variant. Fall back to the public
    // price when no wholesale price is set — the invoice still uses this
    // effective price so the customer knows exactly what they will pay.
    let unit: number;
    if (line.variant === 'NO_SHRINK') {
      if (customer === null || p.b2bPriceNoShrink === null) {
        rejections.push({ productId: line.productId, reason: 'no_variant' });
        continue;
      }
      unit = p.b2bPriceNoShrink !== null ? Number(p.b2bPriceNoShrink) : Number(p.noShrinkPrice);
    } else {
      if (customer === null || p.b2bPrice === null) {
        rejections.push({ productId: line.productId, reason: 'no_variant' });
        continue;
      }
      unit = p.b2bPrice !== null ? Number(p.b2bPrice) : Number(p.price);
    }

    // Stock check (server-side, silent enforcement)
    const available = line.variant === 'NO_SHRINK' ? p.noShrinkStock : p.stock;
    if (line.quantity > available) {
      rejections.push({ productId: line.productId, reason: 'insufficient_stock' });
      continue;
    }

    // Round to 2 decimals (EUR cents) to avoid floating-point drift.
    const lineTotal = Math.round(unit * line.quantity * 100) / 100;
    persisted.push({
      productId: line.productId,
      variant: line.variant,
      quantity: line.quantity,
      name: p.name,
      unitPriceEur: Math.round(unit * 100) / 100,
      lineTotal,
    });
  }

  if (persisted.length === 0) {
    return NextResponse.json(
      {
        error:
          'Ningún producto del carrito está disponible para realizar el pedido.',
        rejections,
      },
      { status: 409 }
    );
  }

  // B2B unit prices are treated as VAT-inclusive (this is what the customer
  // sees in the cart and agrees to pay). We store the pre-tax base and the
  // 21 % IVA amount separately so the invoice can split them out:
  //   base_imponible = gross / 1.21
  //   IVA (21 %)     = gross - base_imponible
  //   total          = gross
  const gross = Math.round(persisted.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const subtotal = Math.round((gross / (1 + B2B_IVA_RATE)) * 100) / 100;
  const ivaAmount = Math.round((gross - subtotal) * 100) / 100;
  const total = gross;

  const notes = truncate(typeof body.notes === 'string' ? body.notes : null, 2000);

  try {
    const order = await db.$transaction(async (tx) => {
      const orderNumber = await generateB2bOrderNumber(tx);
      return tx.b2bOrder.create({
        data: {
          customerId: customer.id,
          orderNumber,
          status: 'PENDING',
          items: persisted as unknown as object[],
          subtotal,
          ivaAmount,
          total,
          notes,
        },
      });
    });

    // Fire-and-forget notification emails.
    const emailLines: OrderEmailLine[] = persisted.map((i) => ({
      name: i.name,
      variant: i.variant,
      quantity: i.quantity,
      unitPriceEur: i.unitPriceEur,
      lineTotal: i.lineTotal,
    }));
    void sendB2bOrderRequestEmail({
      orderNumber: order.orderNumber,
      customerCompany: customer.companyName,
      customerEmail: customer.email,
      contactName: customer.contactName,
      items: emailLines,
      subtotal,
      ivaAmount,
      total,
      notes,
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'order_request_email' },
        extra: { orderId: order.id },
      });
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal,
        ivaAmount,
        total,
      },
      rejections: rejections.length > 0 ? rejections : undefined,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'create_order' },
      extra: { customerId: customer.id },
    });
    return NextResponse.json(
      { error: 'No se pudo registrar el pedido.' },
      { status: 500 }
    );
  }
}
