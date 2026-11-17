import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { lotteryErrorResponse } from '@/lib/lottery/http';
import { ADMIN_ACTOR_ID, reviewLotteryParticipation, type ReviewDecision } from '@/lib/lottery/service';

type RouteContext = { params: Promise<{ id: string; participationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, participationId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      decision?: unknown;
      reason?: unknown;
      details?: unknown;
    } | null;
    const decision = body?.decision;
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return NextResponse.json({ error: 'Decisión no válida.' }, { status: 400 });
    }
    const participation = await reviewLotteryParticipation({
      lotteryId: id,
      participationId,
      decision: decision as ReviewDecision,
      reason: body?.reason,
      details: body?.details,
      adminId: ADMIN_ACTOR_ID,
    });
    return NextResponse.json({ participation });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.review', request);
  }
}
