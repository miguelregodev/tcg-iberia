import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getLoyaltyAdministrator } from '@/lib/loyalty/admin';
import { applyLoyaltyBackfillForUser, LoyaltyBackfillAlreadyAppliedError } from '@/lib/loyalty/backfill';
import { LoyaltyOperationError } from '@/lib/loyalty/ledger';
import { isLoyaltyEnabled } from '@/lib/loyalty/local-preview';
import { captureServerError } from '@/lib/observability/sentry';

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!isLoyaltyEnabled()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  const adminActor = getLoyaltyAdministrator(request);
  if (!adminActor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  const { userId } = await params;
  try {
    const result = await db.$transaction(
      (tx) => applyLoyaltyBackfillForUser(tx, { userId, adminActor, now: new Date() }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof LoyaltyBackfillAlreadyAppliedError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof LoyaltyOperationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      return NextResponse.json({ error: 'La cuenta cambió durante la migración. Recarga la tabla e inténtalo de nuevo.' }, { status: 409 });
    }
    captureServerError({ error, module: 'loyalty_backfill_apply', request });
    return NextResponse.json({ error: 'No se pudieron migrar los puntos del cliente.' }, { status: 500 });
  }
}
