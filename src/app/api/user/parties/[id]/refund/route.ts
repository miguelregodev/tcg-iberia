import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { lockPartyForUpdate, updatePartyCapacityStatus } from '@/lib/parties/db';
import { isSameOriginRequest } from '@/lib/security/request';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
    }
    const { id: partyId } = await params;
    await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, partyId);
      const party = await tx.party.findUnique({
        where: { id: partyId },
        select: { status: true },
      });
      if (!party || !['OPEN', 'FULL'].includes(party.status)) {
        throw new Error('PARTY_REFUND_NOT_ALLOWED');
      }
      const participation = await tx.partyParticipation.findFirst({
        where: { partyId, userId: session.user.id, status: 'PAID', refundStatus: 'NONE' },
        select: { id: true },
      });
      if (!participation) throw new Error('PARTY_PARTICIPATION_NOT_FOUND');
      await tx.partyParticipation.update({
        where: { id: participation.id },
        data: { status: 'REFUND_REQUESTED', refundStatus: 'REQUESTED' },
      });
      await tx.partyAuditLog.create({
        data: {
          partyId,
          action: 'REFUND_REQUESTED',
          details: { participationId: participation.id, userId: session.user.id },
        },
      });
      await updatePartyCapacityStatus(tx, partyId);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PARTY_REFUND_NOT_ALLOWED') {
        return NextResponse.json({ error: 'Ya no se pueden solicitar reembolsos para esta Party.' }, { status: 409 });
      }
      if (error.message === 'PARTY_PARTICIPATION_NOT_FOUND') {
        return NextResponse.json({ error: 'No tienes una participación elegible para reembolso.' }, { status: 404 });
      }
    }
    captureServerError({ error, module: 'party_refund_request_api', request });
    return NextResponse.json({ error: 'No se pudo registrar la solicitud.' }, { status: 500 });
  }
}
