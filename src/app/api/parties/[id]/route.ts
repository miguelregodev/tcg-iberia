import { NextRequest, NextResponse } from 'next/server';
import { getPublicParty } from '@/lib/parties/public';
import { captureServerError } from '@/lib/observability/sentry';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const party = (await getPublicParty(id))[0];
    if (!party) return NextResponse.json({ error: 'Party no encontrada.' }, { status: 404 });
    const session = await auth();
    const participation = session?.user?.id
      ? await db.partyParticipation.findFirst({
          where: {
            partyId: id,
            userId: session.user.id,
            status: { in: ['PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
          },
          select: { id: true },
        })
      : null;
    return NextResponse.json(
      { party: { ...party, hasParticipation: participation !== null } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    captureServerError({ error, module: 'party_public_detail_api', request });
    return NextResponse.json({ error: 'No se pudo cargar la Party.' }, { status: 500 });
  }
}
