import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    const order = await db.order.findFirst({
      where: { stripeSessionId: sessionId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      items: order.items,
    });
  } catch (error) {
    captureServerError({
      error,
      module: 'orders_get_by_session_api',
      request: req,
    });
    return NextResponse.json({ error: 'Failed to retrieve order' }, { status: 500 });
  }
}