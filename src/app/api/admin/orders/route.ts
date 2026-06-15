import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';

const VALID_ORDER_STATUS = ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
type OrderStatus = (typeof VALID_ORDER_STATUS)[number];

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSizeRaw = parseInt(searchParams.get('pageSize') || '10', 10) || 10;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);

    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.order.count(),
    ]);

    const serialized = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      fullName: o.fullName,
      email: o.email,
      phone: o.phone,
      shippingAddress: o.shippingAddress,
      shippingPostalCode: o.shippingPostalCode,
      shippingCity: o.shippingCity,
      shippingLocality: o.shippingLocality,
      shippingProvince: o.shippingProvince,
      totalAmount: parseFloat(o.totalAmount.toString()),
      status: o.status,
      stripeSessionId: o.stripeSessionId,
      items: o.items,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return NextResponse.json({
      orders: serialized,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('GET /api/admin/orders error', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { orderId?: string; status?: string };
    const orderId = body.orderId?.trim();
    const status = body.status as OrderStatus | undefined;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    if (!status || !VALID_ORDER_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await db.order.update({
      where: { id: orderId },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        shippingAddress: updated.shippingAddress,
        shippingPostalCode: updated.shippingPostalCode,
        shippingCity: updated.shippingCity,
        shippingLocality: updated.shippingLocality,
        shippingProvince: updated.shippingProvince,
        totalAmount: parseFloat(updated.totalAmount.toString()),
        status: updated.status,
        stripeSessionId: updated.stripeSessionId,
        items: updated.items,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    captureServerError({
      error,
      module: 'admin_orders_patch_api',
      request,
    });
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 },
    );
  }
}
