import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { validateLotteryWriteInput } from '@/lib/lottery/core';
import { lotteryErrorResponse } from '@/lib/lottery/http';
import { ADMIN_ACTOR_ID, deleteLottery, getAdminLottery, updateLottery } from '@/lib/lottery/service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const lottery = await getAdminLottery(id);
    if (!lottery) return NextResponse.json({ error: 'Sorteo no encontrado.' }, { status: 404 });
    return NextResponse.json({ lottery });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.get', request);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = validateLotteryWriteInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const lottery = await updateLottery(id, parsed.value, ADMIN_ACTOR_ID);
    return NextResponse.json({ lottery });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.update', request);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    await deleteLottery(id, ADMIN_ACTOR_ID);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return lotteryErrorResponse(error, 'admin.lotteries.delete', request);
  }
}
