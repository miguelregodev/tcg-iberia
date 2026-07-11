/**
 * POST /api/admin/b2b/orders/[id]/mark-paid
 *
 * Flip an ACCEPTED order to PAID. From this point onward the customer can
 * no longer cancel the order — see `POST /api/b2b/orders/[id]/cancel`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';

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
  if (order.status !== 'ACCEPTED') {
    return NextResponse.json(
      { error: 'Solo pueden marcarse como pagados los pedidos aprobados.' },
      { status: 409 }
    );
  }

  try {
    const updated = await db.b2bOrder.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    return NextResponse.json({
      success: true,
      order: { id: updated.id, status: updated.status },
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo marcar el pedido como pagado.' },
      { status: 500 }
    );
  }
}
