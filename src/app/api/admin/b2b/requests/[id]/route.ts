/**
 * GET /api/admin/b2b/requests/[id]     Return one request with full details.
 * PUT /api/admin/b2b/requests/[id]     Update the collected documentation
 *                                       (used by the "Review" form). Only
 *                                       allowed while status is PENDING.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { isValidActivity, normalizeVat, truncate } from '@/lib/b2b/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const req = await db.b2bRequest.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, status: true, activatedAt: true, lastLoginAt: true },
      },
    },
  });

  if (!req) {
    return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ request: req });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const existing = await db.b2bRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Solo se pueden editar solicitudes pendientes.' },
      { status: 409 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const activity =
    body.activity === null || body.activity === undefined
      ? null
      : isValidActivity(body.activity)
        ? body.activity
        : null;

  try {
    const updated = await db.b2bRequest.update({
      where: { id },
      data: {
        companyName: truncate(body.companyName as string | undefined, 255),
        vatNumber:
          typeof body.vatNumber === 'string' && body.vatNumber.trim().length > 0
            ? normalizeVat(body.vatNumber).slice(0, 64)
            : null,
        modelo036Verified: Boolean(body.modelo036Verified),
        activity,
        activityOther:
          activity === 'OTHER'
            ? truncate(body.activityOther as string | undefined, 255)
            : null,
        shippingAddress: truncate(body.shippingAddress as string | undefined, 2000),
        billingAddress: truncate(body.billingAddress as string | undefined, 2000),
        contactName: truncate(body.contactName as string | undefined, 255),
        nationalId: truncate(body.nationalId as string | undefined, 64),
        phone: truncate(body.phone as string | undefined, 30),
        website: truncate(body.website as string | undefined, 500),
        estimatedVolume: truncate(body.estimatedVolume as string | undefined, 255),
        preferredLanguages: truncate(body.preferredLanguages as string | undefined, 255),
        notes: truncate(body.notes as string | undefined, 4000),
      },
    });

    return NextResponse.json({ request: updated });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron guardar los cambios.' },
      { status: 500 }
    );
  }
}
