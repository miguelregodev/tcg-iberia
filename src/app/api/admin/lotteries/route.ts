import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { validateLotteryWriteInput } from '@/lib/lottery/core';
import { ADMIN_ACTOR_ID, createLottery, listAdminLotteries } from '@/lib/lottery/service';
import { lotteryErrorResponse } from '@/lib/lottery/http';

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const lotteries = await listAdminLotteries();
    return NextResponse.json({ lotteries });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.list', request);
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = validateLotteryWriteInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const lottery = await createLottery(parsed.value, ADMIN_ACTOR_ID);
    return NextResponse.json({ lottery }, { status: 201 });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.create', request);
  }
}
