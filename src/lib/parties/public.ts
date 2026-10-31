import { db } from '@/lib/db';
import { lockPartyForUpdate, updatePartyCapacityStatus } from './db';
import { reconcileVerifiedPartyPayments } from './reconcile';

export async function getPublicParty(id?: string) {
  await reconcileVerifiedPartyPayments();

  const expiredReservations = await db.partyParticipation.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      reservationExpiresAt: { lte: new Date() },
    },
    select: { partyId: true },
    distinct: ['partyId'],
  });
  for (const { partyId } of expiredReservations) {
    await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, partyId);
      await tx.partyParticipation.updateMany({
        where: {
          partyId,
          status: 'PENDING_PAYMENT',
          reservationExpiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED', slotNumber: null, reservationExpiresAt: null },
      });
      await updatePartyCapacityStatus(tx, partyId);
    });
  }

  const parties = await db.party.findMany({
    where: {
      ...(id ? { id } : {}),
      product: { visible: true },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      product: {
        select: { name: true, slug: true, imageUrl: true, language: true },
      },
      participations: {
        where: {
          OR: [
            { status: 'PAID' },
            { status: 'REFUND_REQUESTED' },
            { status: 'PENDING_PAYMENT', reservationExpiresAt: { gt: new Date() } },
          ],
        },
        select: {
          id: true,
          slotNumber: true,
          status: true,
          paidAt: true,
          user: { select: { fullName: true } },
        },
      },
      winnerParticipation: {
        select: { user: { select: { fullName: true } } },
      },
    },
  });

  return parties.map((party) => {
    const occupiedBySlot = new Map(
      party.participations
        .filter((participation) => participation.slotNumber !== null)
        .map((participation) => [participation.slotNumber as number, participation]),
    );
    const paidCount = party.participations.filter(
      (participation) =>
        ['PAID', 'REFUND_REQUESTED'].includes(participation.status) && participation.paidAt,
    ).length;
    const pendingCount = party.participations.filter(
      (participation) => participation.status === 'PENDING_PAYMENT',
    ).length;
    const publicName = (name: string | null) => {
      const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
      if (!parts.length) return null;
      return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
    };

    return {
      id: party.id,
      product: party.product,
      boxPrice: Number(party.boxPrice),
      participationPrice: Number(party.participationPrice),
      packsPerBox: party.packsPerBox,
      participantCount: party.participantCount,
      packsPerParticipant: party.packsPerParticipant,
      mode: party.mode,
      status: party.status,
      tiktokLiveUrl:
        party.status === 'IN_PROGRESS' || party.status === 'COMPLETED'
          ? party.tiktokLiveUrl
          : null,
      startedAt: party.startedAt,
      completedAt: party.completedAt,
      createdAt: party.createdAt,
      paidCount,
      pendingCount,
      winnerName:
        party.status === 'COMPLETED'
          ? publicName(party.winnerParticipation?.user.fullName ?? null)
          : null,
      slots: Array.from({ length: party.participantCount }, (_, index) => {
        const slotNumber = index + 1;
        const participation = occupiedBySlot.get(slotNumber);
        const paid =
          (participation?.status === 'PAID' || participation?.status === 'REFUND_REQUESTED') &&
          participation.paidAt !== null;
        return {
          slotNumber,
          status: paid ? 'PAID' : participation ? 'PENDING' : 'AVAILABLE',
          displayName: paid ? publicName(participation.user.fullName) : null,
        };
      }),
    };
  });
}
