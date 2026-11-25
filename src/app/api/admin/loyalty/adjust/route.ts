import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getLoyaltyAdministrator } from '@/lib/loyalty/admin';
import { applyManualAdjustment, LoyaltyOperationError } from '@/lib/loyalty/ledger';
import { isLoyaltyLocalPreview } from '@/lib/loyalty/local-preview';
import { captureServerError } from '@/lib/observability/sentry';

export async function POST(request: NextRequest) {
  if (!isLoyaltyLocalPreview()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  try {
    const adminActor = getLoyaltyAdministrator(request);
    if (!adminActor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const { email, points, reason, idempotencyKey } = input;
    if (
      typeof email !== 'string' || typeof points !== 'string' ||
      typeof reason !== 'string' || typeof idempotencyKey !== 'string'
    ) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'No se encontró el cliente.' }, { status: 404 });
    const transaction = await db.$transaction((tx) => applyManualAdjustment(tx, {
      userId: user.id,
      adminActor,
      points,
      reason,
      idempotencyKey,
      now: new Date(),
    }));
    return NextResponse.json({ points: transaction.points.toString(), balance: transaction.balanceAfter.toString() });
  } catch (error) {
    if (error instanceof LoyaltyOperationError) return NextResponse.json({ error: error.message }, { status: 400 });
    captureServerError({ error, module: 'loyalty_adjustment', request });
    return NextResponse.json({ error: 'No se pudo realizar el ajuste.' }, { status: 500 });
  }
}
