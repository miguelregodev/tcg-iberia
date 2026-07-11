/**
 * POST /api/admin/b2b/requests/[id]/reject
 *
 * Marks a PENDING request as REJECTED. Records the reviewing admin and
 * (optionally) a rejection reason for future reference. Does NOT send an
 * automatic email — rejection communication is intentionally handled by the
 * admin manually so tone can be tailored per case.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { truncate } from '@/lib/b2b/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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
      { error: 'La solicitud ya ha sido procesada.' },
      { status: 409 }
    );
  }

  let reason: string | null = null;
  try {
    const body = await request.json();
    reason = truncate(body?.reason, 1000);
  } catch {
    // No body is fine — reason is optional.
  }

  const adminEmail =
    request.cookies.get('tcg_admin_auth')?.value ?? 'admin@tcgiberia.com';

  try {
    const updated = await db.b2bRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedByEmail: adminEmail,
        rejectionReason: reason,
      },
    });
    return NextResponse.json({ request: updated });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo rechazar la solicitud.' },
      { status: 500 }
    );
  }
}
