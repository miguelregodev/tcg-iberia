import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { calculateTierProgress } from '@/lib/loyalty/calculations';
import { getLocalAccount } from '@/lib/loyalty/ledger';
import { isLoyaltyEnabled } from '@/lib/loyalty/local-preview';
import { serializeTierTrack } from '@/lib/loyalty/presentation';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isLoyaltyEnabled()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const { id } = await params;
    const reward = await db.loyaltyOrderReward.findFirst({
      where: { orderId: id, order: { loyaltyPurchase: { userId: session.user.id }, paymentStatus: 'PAID' } },
      select: { pointsEarned: true, tierName: true },
    });
    if (!reward) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    const data = await db.$transaction((tx) => getLocalAccount(tx, session.user.id, new Date()));
    const progress = calculateTierProgress(data.config.tiers, data.spending);
    const available = Prisma.Decimal.max(data.balance.minus(data.reserved), 0);
    return NextResponse.json({
      pointsEarned: reward.pointsEarned.toString(),
      previousTier: reward.tierName,
      currentTier: progress.current.name,
      multiplier: progress.current.multiplier.toString(),
      available: available.toString(),
      value: available.dividedBy(data.config.pointsPerEuro).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN).toFixed(2),
      nextTier: progress.next?.name ?? null,
      remaining: progress.remaining.toFixed(2),
      progress: progress.percentage.toNumber(),
      tiers: serializeTierTrack(data.config.tiers),
    });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_order_summary', request });
    return NextResponse.json({ error: 'No se pudo cargar el resumen de recompensas.' }, { status: 500 });
  }
}
