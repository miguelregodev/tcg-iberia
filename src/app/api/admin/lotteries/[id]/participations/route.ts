import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { lotteryErrorResponse } from '@/lib/lottery/http';
import { listLotteryParticipations } from '@/lib/lottery/service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const participations = await listLotteryParticipations(id, status);
    return NextResponse.json({ participations });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.participations', request);
  }
}
