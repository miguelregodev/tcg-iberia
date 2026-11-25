import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getLoyaltyAdministrator } from '@/lib/loyalty/admin';
import { LoyaltyBalanceConflictError, setLoyaltyBalance } from '@/lib/loyalty/admin-accounts';
import { LoyaltyOperationError } from '@/lib/loyalty/ledger';
import { isLoyaltyEnabled } from '@/lib/loyalty/local-preview';
import { captureServerError } from '@/lib/observability/sentry';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!isLoyaltyEnabled()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  const adminActor = getLoyaltyAdministrator(request);
  if (!adminActor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  const { balance, expectedBalance, idempotencyKey } = (body ?? {}) as Record<string, unknown>;
  if (typeof balance !== 'string' || typeof expectedBalance !== 'string' || typeof idempotencyKey !== 'string') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  const { userId } = await params;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'No se encontró el cliente.' }, { status: 404 });
    const result = await db.$transaction((tx) => setLoyaltyBalance(tx, {
      userId: user.id,
      adminActor,
      targetBalance: balance.trim(),
      expectedBalance,
      idempotencyKey,
      now: new Date(),
    }));
    return NextResponse.json({ balance: result.balance.toFixed(2) });
  } catch (error) {
    if (error instanceof LoyaltyBalanceConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof LoyaltyOperationError) return NextResponse.json({ error: error.message }, { status: 400 });
    captureServerError({ error, module: 'loyalty_admin_balance', request });
    return NextResponse.json({ error: 'No se pudo actualizar el saldo.' }, { status: 500 });
  }
}
