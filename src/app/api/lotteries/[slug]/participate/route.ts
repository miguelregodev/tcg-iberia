import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSameOriginRequest } from '@/lib/security/request';
import { lotteryErrorResponse } from '@/lib/lottery/http';
import { submitLotteryParticipation } from '@/lib/lottery/service';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Debes iniciar sesión para participar.' }, { status: 401 });
  }
  try {
    const { slug } = await context.params;
    const body = await request.json().catch(() => null);
    const participation = await submitLotteryParticipation({ userId, slug, body });
    return NextResponse.json(
      {
        participation,
        message:
          '¡Tu participación ha sido registrada correctamente! Nuestro equipo revisará los datos de tu pedido y recibirás un correo electrónico cuando tu participación haya sido validada.',
      },
      { status: 201 },
    );
  } catch (error) {
    return lotteryErrorResponse(error, 'lotteries.participate', request);
  }
}
