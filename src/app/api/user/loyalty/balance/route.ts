import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLocalAccount } from '@/lib/loyalty/ledger';
import { isLoyaltyEnabled } from '@/lib/loyalty/local-preview';
import { captureServerError } from '@/lib/observability/sentry';

export async function GET(request: NextRequest) {
  if (!isLoyaltyEnabled()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const result = await db.$transaction(async (tx) => {
      const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({
        where: { id: 'default' },
        select: { enabled: true },
      });
      if (!config.enabled) return null;
      const data = await getLocalAccount(tx, session.user.id, new Date());
      const available = Prisma.Decimal.max(data.balance.minus(data.reserved), 0);
      return {
        points: available.toString(),
        value: available.dividedBy(data.config.pointsPerEuro).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN).toFixed(2),
      };
    });

    if (!result) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_balance', request });
    return NextResponse.json({ error: 'No se pudo cargar el saldo de puntos.' }, { status: 500 });
  }
}
