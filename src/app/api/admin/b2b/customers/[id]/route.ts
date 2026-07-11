/**
 * GET    /api/admin/b2b/customers/[id]  Return a single customer.
 * PUT    /api/admin/b2b/customers/[id]  Update the customer's profile fields.
 * DELETE /api/admin/b2b/customers/[id]  Permanently remove the customer.
 *
 * Password changes are NOT handled here — those go through the activation /
 * reset flow so plaintext passwords never reach admin routes.
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

  const customer = await db.b2bCustomer.findUnique({
    where: { id },
    include: { request: { select: { id: true, createdAt: true, reviewedAt: true } } },
  });
  if (!customer) {
    return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  }
  return NextResponse.json({ customer });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const activity = isValidActivity(body.activity) ? body.activity : undefined;

  try {
    const customer = await db.b2bCustomer.update({
      where: { id },
      data: {
        companyName: truncate(body.companyName as string | undefined, 255) ?? undefined,
        vatNumber:
          typeof body.vatNumber === 'string' && body.vatNumber.trim().length > 0
            ? normalizeVat(body.vatNumber).slice(0, 64)
            : undefined,
        activity,
        activityOther:
          activity === 'OTHER'
            ? truncate(body.activityOther as string | undefined, 255)
            : activity
              ? null
              : undefined,
        shippingAddress: truncate(body.shippingAddress as string | undefined, 2000) ?? undefined,
        billingAddress: truncate(body.billingAddress as string | undefined, 2000),
        contactName: truncate(body.contactName as string | undefined, 255) ?? undefined,
        nationalId: truncate(body.nationalId as string | undefined, 64),
        phone: truncate(body.phone as string | undefined, 30) ?? undefined,
        website: truncate(body.website as string | undefined, 500),
        estimatedVolume: truncate(body.estimatedVolume as string | undefined, 255),
        preferredLanguages: truncate(body.preferredLanguages as string | undefined, 255),
        notes: truncate(body.notes as string | undefined, 4000),
      },
    });
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo actualizar el cliente.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    await db.b2bCustomer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo eliminar el cliente.' },
      { status: 500 }
    );
  }
}
