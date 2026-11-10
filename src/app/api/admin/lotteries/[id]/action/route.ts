import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import type { LotteryAction } from '@/lib/lottery/core';
import { lotteryErrorResponse } from '@/lib/lottery/http';
import { ADMIN_ACTOR_ID, applyLotteryAction } from '@/lib/lottery/service';

const ACTIONS: readonly LotteryAction[] = ['publish', 'start', 'finish', 'cancel'];

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action;
    if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }
    const lottery = await applyLotteryAction(id, action as LotteryAction, ADMIN_ACTOR_ID);
    return NextResponse.json({ lottery });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.action', request);
  }
}
