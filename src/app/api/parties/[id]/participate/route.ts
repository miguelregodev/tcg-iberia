import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { lockPartyForUpdate, updatePartyCapacityStatus } from '@/lib/parties/db';
import { isSameOriginRequest } from '@/lib/security/request';
import { getRedsysConfig, getRedsysApiUrl } from '@/lib/payments/redsys/config';
import { nextRedsysOrderId } from '@/lib/payments/redsys/orderId';
import { generateSignature, toBase64 } from '@/lib/payments/redsys/signature';
import type { RedsysMerchantParameters } from '@/lib/payments/redsys/types';

const RESERVATION_MINUTES = 31;

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
      return NextResponse.json({ error: 'Debes iniciar sesión para participar.' }, { status: 401 });
    }
    const { id: partyId } = await params;
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        addressLine: true,
        postalCode: true,
        city: true,
        locality: true,
        province: true,
      },
    });
    if (!user?.email) {
      return NextResponse.json({ error: 'Tu cuenta no tiene un correo válido.' }, { status: 400 });
    }

    const now = new Date();
    const reservationExpiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60_000);
    const reservation = await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, partyId);
      await tx.partyParticipation.updateMany({
        where: {
          partyId,
          status: 'PENDING_PAYMENT',
          reservationExpiresAt: { lte: now },
        },
        data: { status: 'EXPIRED', slotNumber: null, reservationExpiresAt: null },
      });
      await updatePartyCapacityStatus(tx, partyId);

      const party = await tx.party.findUnique({
        where: { id: partyId },
        select: {
          id: true,
          status: true,
          participantCount: true,
          participationPrice: true,
          product: { select: { name: true } },
        },
      });
      if (!party) throw new Error('PARTY_NOT_FOUND');
      if (party.status !== 'OPEN') throw new Error('PARTY_NOT_OPEN');

      const previous = await tx.partyParticipation.findFirst({
        where: {
          partyId,
          userId: user.id,
          status: { in: ['PENDING_PAYMENT', 'PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
        },
      });
      if (previous?.status === 'PENDING_PAYMENT' && previous.redsysOrderId) {
        return {
          participationId: previous.id,
          redsysOrderId: previous.redsysOrderId,
          amountCents: Math.round(Number(previous.amountPaid) * 100),
          productName: party.product.name,
        };
      }
      if (previous?.status === 'PENDING_PAYMENT') throw new Error('PARTY_CHECKOUT_PENDING');
      if (previous) throw new Error('PARTY_ALREADY_PARTICIPATING');

      const occupied = await tx.partyParticipation.findMany({
        where: {
          partyId,
          slotNumber: { not: null },
          status: { in: ['PENDING_PAYMENT', 'PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
        },
        select: { slotNumber: true },
      });
      const takenSlots = new Set(occupied.map((entry) => entry.slotNumber));
      const slotNumber = Array.from(
        { length: party.participantCount },
        (_, index) => index + 1,
      ).find((slot) => !takenSlots.has(slot));
      if (!slotNumber) throw new Error('PARTY_NO_CAPACITY');

      const created = await tx.partyParticipation.create({
        data: {
          partyId,
          userId: user.id,
          slotNumber,
          amountPaid: party.participationPrice,
          reservationExpiresAt,
          redsysOrderId: await nextRedsysOrderId(tx),
        },
        select: { id: true, redsysOrderId: true, amountPaid: true },
      });
      return {
        participationId: created.id,
        redsysOrderId: created.redsysOrderId!,
        amountCents: Math.round(Number(created.amountPaid) * 100),
        productName: party.product.name,
      };
    });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get('origin') ||
      'http://localhost:3000';
    const notificationUrl =
      process.env.REDSYS_NOTIFICATION_URL || `${origin}/api/payments/redsys/notification`;
    const merchantConfig = getRedsysConfig();
    const merchantParams: RedsysMerchantParameters = {
      DS_MERCHANT_AMOUNT: String(reservation.amountCents),
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_ORDER: reservation.redsysOrderId,
      DS_MERCHANT_MERCHANTCODE: merchantConfig.merchantCode,
      DS_MERCHANT_TERMINAL: merchantConfig.terminal,
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: `${origin}/checkout/success?party_participation_id=${encodeURIComponent(reservation.participationId)}`,
      DS_MERCHANT_URLKO: `${origin}/parties/${partyId}?payment=failed`,
      DS_MERCHANT_CONSUMERLANGUAGE: '1',
      DS_MERCHANT_PRODUCTDESCRIPTION: `Participación Party - ${reservation.productName}`.slice(0, 125),
    };
    const merchantParameters = toBase64(JSON.stringify(merchantParams));

    return NextResponse.json({
      Ds_MerchantParameters: merchantParameters,
      Ds_Signature: generateSignature(merchantParameters, reservation.redsysOrderId),
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      url: getRedsysApiUrl(),
      participationId: reservation.participationId,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        PARTY_NOT_FOUND: { status: 404, message: 'Party no encontrada.' },
        PARTY_NOT_OPEN: { status: 409, message: 'Esta Party ya no acepta participaciones.' },
        PARTY_NO_CAPACITY: { status: 409, message: 'Esta Party ya no tiene plazas disponibles.' },
        PARTY_ALREADY_PARTICIPATING: { status: 409, message: 'Ya tienes una participación en esta Party.' },
        PARTY_CHECKOUT_PENDING: { status: 409, message: 'Tu pago anterior sigue pendiente. Espera a que se confirme o caduque.' },
      };
      const mapped = errors[error.message];
      if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    captureServerError({ error, module: 'party_participation_redsys_payment_api', request });
    return NextResponse.json({ error: 'No se pudo iniciar el pago de la participación.' }, { status: 500 });
  }
}
