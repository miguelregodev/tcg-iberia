import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { lotteryErrorResponse } from '@/lib/lottery/http';
import { ADMIN_ACTOR_ID, drawLotteryWinner } from '@/lib/lottery/service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const result = await drawLotteryWinner(id, ADMIN_ACTOR_ID);
    return NextResponse.json({ result });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.draw', request);
  }
}
