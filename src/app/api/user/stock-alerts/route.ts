import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { extractEmailDomain } from '@/lib/stock-alerts';

// GET /api/user/stock-alerts - list active alerts for authenticated user
export async function GET() {
  try {
    const session = await auth();
    const sessionEmail = session?.user?.email?.toLowerCase().trim();
    if (!session?.user?.id || !sessionEmail) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    // Reconcile guest subscriptions with the authenticated account.
    await db.stockAlert.updateMany({
      where: {
        userId: null,
        status: { in: ['PENDING', 'SENDING'] },
        email: {
          equals: sessionEmail,
          mode: 'insensitive',
        },
      },
      data: {
        userId: session.user.id,
        email: sessionEmail,
      },
    });

    const alerts = await db.stockAlert.findMany({
      where: {
        status: { in: ['PENDING', 'SENDING'] },
        OR: [
          { userId: session.user.id },
          {
            email: {
              equals: sessionEmail,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            price: true,
            discountPercentage: true,
            stock: true,
            visible: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: alerts });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'api', route: 'user/stock-alerts', method: 'GET' },
    });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// DELETE /api/user/stock-alerts?id=xxx - cancel an active alert
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const sessionEmail = session?.user?.email?.toLowerCase().trim();
    if (!session?.user?.id || !sessionEmail) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id es obligatorio.' }, { status: 400 });
    }

    const existing = await db.stockAlert.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          {
            email: {
              equals: sessionEmail,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alerta no encontrada.' }, { status: 404 });
    }

    await db.stockAlert.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
    });

    await captureServerEvent(session.user.id, 'stock_alert_removed', {
      productId: existing.product.id,
      productName: existing.product.name,
      userId: session.user.id,
      emailDomain: extractEmailDomain(existing.email),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'api', route: 'user/stock-alerts', method: 'DELETE' },
    });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
