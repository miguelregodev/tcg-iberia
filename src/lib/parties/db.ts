import { Prisma } from '@prisma/client';

export async function lockPartyForUpdate(
  tx: Prisma.TransactionClient,
  partyId: string,
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Party" WHERE "id" = ${partyId} FOR UPDATE`);
}

export async function updatePartyCapacityStatus(
  tx: Prisma.TransactionClient,
  partyId: string,
): Promise<void> {
  const party = await tx.party.findUnique({
    where: { id: partyId },
    select: { status: true, participantCount: true },
  });
  if (!party || !['OPEN', 'FULL'].includes(party.status)) return;

  const [paidCount, unresolvedCount] = await Promise.all([
    tx.partyParticipation.count({
      where: {
        partyId,
        status: 'PAID',
        refundStatus: { in: ['NONE', 'REJECTED'] },
      },
    }),
    tx.partyParticipation.count({
      where: {
        partyId,
        OR: [
          { status: { in: ['PENDING_PAYMENT', 'REFUND_REQUIRED'] } },
          { refundStatus: 'REQUESTED' },
        ],
      },
    }),
  ]);

  const status =
    paidCount === party.participantCount && unresolvedCount === 0 ? 'FULL' : 'OPEN';
  if (status !== party.status) {
    await tx.party.update({ where: { id: partyId }, data: { status } });
  }
}

export async function nextPartyOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const sequence = await tx.sequence.upsert({
    where: { name: 'ORDER' },
    create: { name: 'ORDER', value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `TCG-${timestamp}-${String(sequence.value).padStart(6, '0')}`;
}
