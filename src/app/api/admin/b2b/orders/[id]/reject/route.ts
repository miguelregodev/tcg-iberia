/**
 * POST /api/admin/b2b/orders/[id]/reject
 *
 * Reject a PENDING order. Records the admin identity and (optionally) a
 * reason. No PDF, no invoice number issued — REJECTED orders never enter
 * the sequential invoice register.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { truncate } from '@/lib/b2b/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const order = await db.b2bOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
  }
  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Solo los pedidos pendientes pueden rechazarse.' },
      { status: 409 }
    );
  }

  let reason: string | null = null;
  try {
    const body = await request.json();
    reason = truncate(body?.reason, 1000);
  } catch {
    // reason is optional
  }

  try {
    const updated = await db.b2bOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        notes: reason ?? order.notes,
      },
    });
    return NextResponse.json({
      success: true,
      order: { id: updated.id, status: updated.status },
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo rechazar el pedido.' },
      { status: 500 }
    );
  }
}
