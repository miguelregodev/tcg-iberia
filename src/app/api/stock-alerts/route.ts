import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { extractEmailDomain } from '@/lib/stock-alerts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/stock-alerts?productId=xxx
// Authenticated users can check if they already have an active alert for a product.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const sessionEmail = session?.user?.email?.toLowerCase().trim();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const productId = request.nextUrl.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json({ error: 'productId es obligatorio.' }, { status: 400 });
    }

    const existing = await db.stockAlert.findFirst({
      where: {
        productId,
        status: { in: ['PENDING', 'SENDING'] },
        OR: [
          { userId: session.user.id },
          {
            email: {
              equals: sessionEmail ?? '',
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, isSubscribed: !!existing });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'api', route: 'stock-alerts', method: 'GET' },
    });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// POST /api/stock-alerts
// Body: { productId: string, email?: string }
// - Auth user: email auto-derived from session.
// - Guest: email is required.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = (await request.json()) as { productId?: string; email?: string };

    const productId = (body.productId ?? '').trim();
    if (!productId) {
      return NextResponse.json({ error: 'productId es obligatorio.' }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }

    if (product.stock > 0) {
      return NextResponse.json(
        { error: 'Este producto ya está disponible. No hace falta crear una alerta.' },
        { status: 409 }
      );
    }

    const emailFromSession = session?.user?.email?.toLowerCase().trim();
    const sessionUserId = session?.user?.id ?? null;
    const guestEmail = (body.email ?? '').toLowerCase().trim();
    const email = emailFromSession || guestEmail;

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Correo electrónico no válido.' }, { status: 400 });
    }

    if (sessionUserId && emailFromSession) {
      // Link previous guest alerts to the authenticated account so they appear in account pages.
      await db.stockAlert.updateMany({
        where: {
          userId: null,
          email: {
            equals: emailFromSession,
            mode: 'insensitive',
          },
          status: { in: ['PENDING', 'SENDING'] },
        },
        data: { userId: sessionUserId, email: emailFromSession },
      });
    }

    // Lightweight anti-abuse for guest flow.
    if (!session?.user?.id) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const attempts = await db.stockAlert.count({
        where: {
          email,
          createdAt: { gte: oneHourAgo },
        },
      });
      if (attempts >= 10) {
        return NextResponse.json(
          { error: 'Has alcanzado el límite de alertas por hora. Inténtalo más tarde.' },
          { status: 429 }
        );
      }
    }

    const existingAlert = await db.stockAlert.findFirst({
      where: {
        productId: product.id,
        OR: [
          ...(sessionUserId ? [{ userId: sessionUserId }] : []),
          {
            email: {
              equals: email,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    if (existingAlert && (existingAlert.status === 'PENDING' || existingAlert.status === 'SENDING')) {
      return NextResponse.json(
        { success: true, alreadyExists: true, message: 'Ya existe una alerta para este producto.' },
        { status: 200 }
      );
    }

    if (existingAlert && (existingAlert.status === 'SENT' || existingAlert.status === 'CANCELLED')) {
      const reactivated = await db.stockAlert.update({
        where: { id: existingAlert.id },
        data: {
          userId: sessionUserId,
          email,
          status: 'PENDING',
          notifiedAt: null,
        },
      });

      await captureServerEvent(sessionUserId ?? email, 'stock_alert_created', {
        productId: product.id,
        productName: product.name,
        userId: sessionUserId,
        emailDomain: extractEmailDomain(email),
      });

      return NextResponse.json(
        {
          success: true,
          data: { id: reactivated.id },
          message: 'Tu alerta se ha reactivado. Te avisaremos cuando vuelva a haber stock.',
        },
        { status: 200 }
      );
    }

    let created;
    try {
      created = await db.stockAlert.create({
        data: {
          productId: product.id,
          userId: sessionUserId,
          email,
          status: 'PENDING',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraints can race under concurrent requests.
        const current = await db.stockAlert.findFirst({
          where: {
            productId: product.id,
            OR: [
              ...(sessionUserId ? [{ userId: sessionUserId }] : []),
              {
                email: {
                  equals: email,
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: { id: true, status: true },
        });

        if (current && (current.status === 'SENT' || current.status === 'CANCELLED')) {
          const reactivated = await db.stockAlert.update({
            where: { id: current.id },
            data: {
              userId: sessionUserId,
              email,
              status: 'PENDING',
              notifiedAt: null,
            },
          });

          return NextResponse.json(
            {
              success: true,
              data: { id: reactivated.id },
              message: 'Tu alerta se ha reactivado. Te avisaremos cuando vuelva a haber stock.',
            },
            { status: 200 }
          );
        }

        return NextResponse.json(
          { success: true, alreadyExists: true, message: 'Ya existe una alerta para este producto.' },
          { status: 200 }
        );
      }
      throw error;
    }

    await captureServerEvent(sessionUserId ?? email, 'stock_alert_created', {
      productId: product.id,
      productName: product.name,
      userId: sessionUserId,
      emailDomain: extractEmailDomain(email),
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: created.id },
        message: 'Te avisaremos cuando este producto vuelva a estar disponible.',
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'api', route: 'stock-alerts', method: 'POST' },
    });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
