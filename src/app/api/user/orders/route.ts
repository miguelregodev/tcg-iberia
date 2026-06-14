import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/user/orders — returns orders for the authenticated user (by userId or email)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    // Find by userId link OR by matching email (for orders placed before login existed)
    const orders = await db.order.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { email: session.user.email ?? '' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        fullName: true,
        email: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        items: true,
      },
    });

    const mapped = orders.map((o) => ({
      ...o,
      totalAmount: parseFloat(o.totalAmount.toString()),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/orders' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
