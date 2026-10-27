import { db } from '@/lib/db';
import { sendPartyParticipationEmails } from '@/lib/email';

/** Sends the Party-specific confirmation emails for the participation linked to an order. */
export async function sendPartyParticipationConfirmation(orderId: string): Promise<void> {
  const participation = await db.partyParticipation.findUnique({
    where: { orderId },
    select: {
      slotNumber: true,
      amountPaid: true,
      party: {
        select: {
          id: true,
          participantCount: true,
          packsPerParticipant: true,
          mode: true,
          product: { select: { name: true } },
        },
      },
      order: {
        select: { orderNumber: true, fullName: true, email: true, phone: true },
      },
    },
  });
  if (!participation?.order) throw new Error(`Party participation not found for order: ${orderId}`);

  await sendPartyParticipationEmails({
    orderNumber: participation.order.orderNumber,
    fullName: participation.order.fullName,
    email: participation.order.email,
    phone: participation.order.phone,
    amountPaid: Number(participation.amountPaid),
    partyId: participation.party.id,
    productName: participation.party.product.name,
    slotNumber: participation.slotNumber,
    participantCount: participation.party.participantCount,
    packsPerParticipant: participation.party.packsPerParticipant,
    mode: participation.party.mode,
  });
}
