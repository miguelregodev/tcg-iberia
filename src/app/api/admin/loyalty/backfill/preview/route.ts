import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getLoyaltyAdministrator } from '@/lib/loyalty/admin';
import { isLoyaltyLocalPreview } from '@/lib/loyalty/local-preview';
import { previewLoyaltyBackfill } from '@/lib/loyalty/backfill';
import { captureServerError } from '@/lib/observability/sentry';

export async function POST(request: NextRequest) {
  if (!isLoyaltyLocalPreview()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  if (!getLoyaltyAdministrator(request)) {
    return NextResponse.json({ error: 'Se requiere una sesión de backoffice.' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }
  const activationAt = body && typeof body === 'object' && !Array.isArray(body) && 'activationAt' in body
    ? body.activationAt : null;
  if (typeof activationAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(activationAt) ||
    !Number.isFinite(new Date(activationAt).getTime()) || new Date(activationAt) > new Date()) {
    return NextResponse.json({ error: 'Indica una fecha de activación ISO con zona horaria, no futura.' }, { status: 400 });
  }
  try {
    const report = await db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
      return previewLoyaltyBackfill(tx, new Date(activationAt));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_backfill_preview', request });
    return NextResponse.json({ error: 'No se pudo generar la simulación de puntos históricos.' }, { status: 500 });
  }
}
