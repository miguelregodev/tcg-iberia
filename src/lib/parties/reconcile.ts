import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { lockPartyForUpdate, nextPartyOrderNumber, updatePartyCapacityStatus } from './db';
import { sendPartyParticipationConfirmation } from './notify';

function isRecoveryEvidence(
  details: Prisma.JsonValue,
  participationId: string,
  expectedCents: number,
): boolean {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
  return (
    details.participationId === participationId &&
    details.partyStatus === 'OPEN' &&
    (details.currency === undefined || details.currency === '978') &&
    details.expectedCents === expectedCents &&
    details.actualCents === expectedCents
  );
}

export async function reconcileVerifiedPartyPayments(): Promise<void> {
  const candidates = await db.partyParticipation.findMany({
    where: {
      status: 'REFUND_REQUIRED',
      paidAt: { not: null },
      orderId: null,
      party: { status: 'OPEN' },
    },
    select: { id: true, partyId: true },
  });

  for (const candidate of candidates) {
    const orderId = await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, candidate.partyId);
      const record = await tx.partyParticipation.findUnique({
        where: { id: candidate.id },
        include: {
          party: {
            include: {
              product: { select: { name: true } },
              auditLogs: {
                where: { action: 'PAYMENT_RECOVERY_REQUIRED' },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { details: true },
              },
            },
          },
          user: true,
          order: { select: { id: true } },
        },
      });
      if (
        !record ||
        record.status !== 'REFUND_REQUIRED' ||
        !record.paidAt ||
        record.order ||
        record.party.status !== 'OPEN'
      ) {
        return null;
      }

      const expectedCents = Math.round(Number(record.amountPaid) * 100);
      const hasVerifiedPaymentEvidence = record.party.auditLogs.some((audit) =>
        isRecoveryEvidence(audit.details, record.id, expectedCents),
      );
      if (!hasVerifiedPaymentEvidence) return null;

      const now = new Date();
      await tx.partyParticipation.updateMany({
        where: {
          partyId: record.partyId,
          status: 'PENDING_PAYMENT',
          reservationExpiresAt: { lte: now },
        },
        data: { status: 'EXPIRED', slotNumber: null, reservationExpiresAt: null },
      });
      const occupied = await tx.partyParticipation.findMany({
        where: {
          partyId: record.partyId,
          id: { not: record.id },
          slotNumber: { not: null },
          status: { in: ['PENDING_PAYMENT', 'PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
        },
        select: { slotNumber: true },
      });
      const taken = new Set(occupied.map((entry) => entry.slotNumber));
      const slotNumber = Array.from(
        { length: record.party.participantCount },
        (_, index) => index + 1,
      ).find((slot) => !taken.has(slot));
      if (!slotNumber) return null;

      const order = await tx.order.create({
        data: {
          orderNumber: await nextPartyOrderNumber(tx),
          userId: record.userId,
          fullName: record.user.fullName || 'Cliente',
          email: record.user.email,
          phone: record.user.phone || '',
          shippingAddress: record.user.addressLine || '',
          shippingPostalCode: record.user.postalCode || '',
          shippingCity: record.user.city || '',
          shippingLocality: record.user.locality || '',
          shippingProvince: record.user.province || '',
          totalAmount: String(expectedCents / 100),
          status: 'PROCESSING',
          paymentStatus: 'PAID',
          paymentProvider: 'redsys',
          redsysOrderId: record.redsysOrderId,
          redsysTransactionId: record.redsysTransactionId || null,
          paymentAmount: String(expectedCents / 100),
          paymentCurrency: 'EUR',
          paymentPaidAt: record.paidAt,
          shippingMode: 'GROUPED',
          items: [
            {
              id: record.party.productId,
              productId: record.party.productId,
              name: `Participación Party — ${record.party.product.name}`,
              quantity: 1,
              price: expectedCents / 100,
              isPartyParticipation: true,
            },
          ] as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await tx.partyParticipation.update({
        where: { id: record.id },
        data: {
          status: 'PAID',
          refundStatus: 'NONE',
          slotNumber,
          reservationExpiresAt: null,
          redsysTransactionId: record.redsysTransactionId || null,
          orderId: order.id,
        },
      });
      await tx.partyAuditLog.create({
        data: {
          partyId: record.partyId,
          action: 'PAYMENT_RECOVERED',
          details: {
            participationId: record.id,
            orderId: order.id,
            redsysOrderId: record.redsysOrderId,
            slotNumber,
          },
        },
      });
      await updatePartyCapacityStatus(tx, record.partyId);
      return order.id;
    });

    if (!orderId) continue;
    try {
      await sendPartyParticipationConfirmation(orderId);
    } catch (error) {
      captureServerError({ error, module: 'party_recovered_order_email', orderId });
    }
  }
}
