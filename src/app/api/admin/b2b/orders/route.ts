/**
 * GET /api/admin/b2b/orders
 *
 * Lists every B2B order (across all customers), most recent first, together
 * with the minimum customer info the admin panel needs to render the table.
 *
 * Query params:
 *   ?status=PENDING|ACCEPTED|PAID|CANCELLED|REJECTED (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2bOrderStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';

const VALID: readonly B2bOrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PAID',
  'CANCELLED',
  'REJECTED',
];

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get('status');
  const status =
    rawStatus && VALID.includes(rawStatus as B2bOrderStatus)
      ? (rawStatus as B2bOrderStatus)
      : undefined;

  try {
    const orders = await db.b2bOrder.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            email: true,
            vatNumber: true,
            contactName: true,
            phone: true,
            shippingAddress: true,
          },
        },
      },
    });
    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        ivaAmount: Number(o.ivaAmount),
        total: Number(o.total),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron cargar los pedidos.' },
      { status: 500 }
    );
  }
}
