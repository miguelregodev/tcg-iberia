import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { sendPartyParticipationConfirmation } from './notify';
import {
  extractRedsysAmount,
  extractRedsysAuthCode,
  extractRedsysTransactionReference,
} from '@/lib/payments/redsys/parseNotification';
import { isRedsysResponseSuccess } from '@/lib/payments/redsys/types';
import type { RedsysResponseParameters } from '@/lib/payments/redsys/types';
import { isValidPartyPaymentConfirmation } from './core';
import { lockPartyForUpdate, nextPartyOrderNumber, updatePartyCapacityStatus } from './db';

/**
 * Applies a signature-verified Redsys result to a party participation.
 * Idempotent: shared by the server-to-server notification and the signed OK-URL return.
 * Returns null when the Redsys order does not belong to a party participation.
 */
export async function processPartyParticipationPayment(
  redsysOrderId: string,
  responseCode: string,
  params: RedsysResponseParameters,
  request?: NextRequest,
): Promise<{ requiresAdministrativeResolution: boolean } | null> {
  const participation = await db.partyParticipation.findUnique({
    where: { redsysOrderId },
    select: { id: true, partyId: true },
  });
  if (!participation) return null;

  const amountCents = extractRedsysAmount(params);
  const currency = params.Ds_Currency ?? '978';
  const transactionId = extractRedsysTransactionReference(params);
  const authCode = extractRedsysAuthCode(params);

  if (!isRedsysResponseSuccess(responseCode)) {
    await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, participation.partyId);
      const result = await tx.partyParticipation.updateMany({
        where: {
          id: participation.id,
          status: 'PENDING_PAYMENT',
        },
        data: {
          status: 'EXPIRED',
          slotNumber: null,
          reservationExpiresAt: null,
          redsysTransactionId: transactionId || null,
        },
      });
      if (result.count > 0) {
        await tx.partyAuditLog.create({
          data: {
            partyId: participation.partyId,
            action: 'PAYMENT_FAILED',
            details: { participationId: participation.id, redsysOrderId, responseCode },
          },
        });
      }
      await updatePartyCapacityStatus(tx, participation.partyId);
    });
    return { requiresAdministrativeResolution: false };
  }

  const result = await db.$transaction(async (tx) => {
    await lockPartyForUpdate(tx, participation.partyId);
    const record = await tx.partyParticipation.findUnique({
      where: { id: participation.id },
      include: {
        party: { include: { product: true } },
        user: true,
        order: { select: { id: true, orderNumber: true } },
      },
    });
    if (!record) throw new Error(`Party participation disappeared: ${participation.id}`);
    if (record.status === 'PAID' && record.order) {
      return { kind: 'already-paid' as const, orderId: record.order.id };
    }
    if (record.status === 'REFUNDED') {
      return { kind: 'already-paid' as const, orderId: null };
    }
    const expectedCents = Math.round(Number(record.amountPaid) * 100);
    const paidAt = new Date();
    let slotNumber = record.slotNumber;
    if (
      record.status !== 'PENDING_PAYMENT' ||
      !record.reservationExpiresAt ||
      record.reservationExpiresAt <= paidAt ||
      record.party.status !== 'OPEN' ||
      !isValidPartyPaymentConfirmation(expectedCents, amountCents, currency)
    ) {
      slotNumber = null;
    }

    if (
      slotNumber === null &&
      isValidPartyPaymentConfirmation(expectedCents, amountCents, currency) &&
      record.party.status === 'OPEN'
    ) {
      await tx.partyParticipation.updateMany({
        where: {
          partyId: record.partyId,
          status: 'PENDING_PAYMENT',
          reservationExpiresAt: { lte: paidAt },
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
      slotNumber = Array.from(
        { length: record.party.participantCount },
        (_, index) => index + 1,
      ).find((slot) => !taken.has(slot)) ?? null;
    }

    if (slotNumber === null || !isValidPartyPaymentConfirmation(expectedCents, amountCents, currency)) {
      await tx.partyParticipation.update({
        where: { id: record.id },
        data: {
          status: 'REFUND_REQUIRED',
          refundStatus: 'NONE',
          slotNumber: null,
          reservationExpiresAt: null,
          redsysTransactionId: transactionId || null,
          paidAt,
        },
      });
      await tx.partyAuditLog.create({
        data: {
          partyId: record.partyId,
          action: 'PAYMENT_RECOVERY_REQUIRED',
          details: {
            participationId: record.id,
            redsysOrderId,
            transactionId,
            actualCents: amountCents,
            expectedCents,
            currency,
            partyStatus: record.party.status,
          },
        },
      });
      return { kind: 'recovery-required' as const, orderId: null };
    }

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
        redsysOrderId,
        redsysTransactionId: transactionId || null,
        redsysResponseCode: responseCode,
        redsysAuthCode: authCode,
        paymentAmount: String(expectedCents / 100),
        paymentCurrency: 'EUR',
        paymentPaidAt: paidAt,
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
        ] as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, orderNumber: true },
    });
    await tx.partyParticipation.update({
      where: { id: record.id },
      data: {
        status: 'PAID',
        refundStatus: 'NONE',
        slotNumber,
        reservationExpiresAt: null,
        paidAt,
        redsysTransactionId: transactionId || null,
        orderId: order.id,
      },
    });
    await tx.partyAuditLog.create({
      data: {
        partyId: record.partyId,
        action: 'PAYMENT_CONFIRMED',
        details: { participationId: record.id, orderId: order.id, redsysOrderId, transactionId, slotNumber },
      },
    });
    await updatePartyCapacityStatus(tx, record.partyId);
    return { kind: 'paid' as const, orderId: order.id };
  });

  if (result.kind === 'paid' && result.orderId) {
    try {
      await sendPartyParticipationConfirmation(result.orderId);
    } catch (error) {
      captureServerError({ error, module: 'party_order_confirmation_email', request, orderId: result.orderId });
    }
  }
  return { requiresAdministrativeResolution: result.kind === 'recovery-required' };
}
