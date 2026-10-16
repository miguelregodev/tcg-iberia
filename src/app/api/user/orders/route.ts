import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const PAGE_SIZE = 20;

// GET /api/user/orders?page=1 — returns a page of orders for the authenticated user (by userId or email)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    // Find by userId link OR by matching email (for orders placed before login existed)
    const where = {
      OR: [
        { userId: session.user.id },
        { email: session.user.email ?? '' },
      ],
    };

    const total = await db.order.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const requestedPage = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
    const page = Math.min(totalPages, Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1);

    const orders = await db.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        fullName: true,
        email: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        items: true,
        shippingMode: true,
        shipmentId: true,
        shipment: {
          select: {
            shipmentNumber: true,
            shippingCost: true,
            paymentStatus: true,
          },
        },
      },
    });

    // Order items snapshot only the product id (with a `_live` suffix for live-opening lines);
    // resolve current slugs so the UI can link to the product detail page.
    const baseId = (id: string) => id.replace(/_live$/, '');
    const productIds = new Set<string>();
    for (const o of orders) {
      if (!Array.isArray(o.items)) continue;
      for (const item of o.items as Array<{ id?: unknown }>) {
        if (typeof item?.id === 'string') productIds.add(baseId(item.id));
      }
    }
    const products = productIds.size
      ? await db.product.findMany({
          where: { id: { in: Array.from(productIds) }, visible: true },
          select: { id: true, slug: true },
        })
      : [];
    const slugById = new Map(products.map((p) => [p.id, p.slug]));

    const mapped = orders.map((o) => ({
      ...o,
      items: Array.isArray(o.items)
        ? (o.items as Array<Record<string, unknown>>).map((item) => ({
            ...item,
            slug: typeof item?.id === 'string' ? slugById.get(baseId(item.id)) ?? null : null,
          }))
        : o.items,
      totalAmount: parseFloat(o.totalAmount.toString()),
      shipment: o.shipment
        ? { ...o.shipment, shippingCost: parseFloat(o.shipment.shippingCost.toString()) }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/orders' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
