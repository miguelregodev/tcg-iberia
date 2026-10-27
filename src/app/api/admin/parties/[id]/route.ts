import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { getStartPartyError, isValidTikTokLiveUrl } from '@/lib/parties/core';
import { lockPartyForUpdate, updatePartyCapacityStatus } from '@/lib/parties/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: partyId } = await params;
  try {
    const body = (await request.json()) as {
      action?: unknown;
      tiktokLiveUrl?: unknown;
      winnerParticipationId?: unknown;
      participationId?: unknown;
      resolution?: unknown;
    };
    if (body.action === 'cancel') {
      const cancellation = await db.$transaction(async (tx) => {
        await lockPartyForUpdate(tx, partyId);
        const party = await tx.party.findUnique({
          where: { id: partyId },
          select: { status: true, inventoryReleased: true, productId: true },
        });
        if (!party) throw new Error('PARTY_NOT_FOUND');
        if (party.status !== 'OPEN') throw new Error('PARTY_CANCEL_NOT_ALLOWED');

        const pending = await tx.partyParticipation.findMany({
          where: { partyId, status: 'PENDING_PAYMENT' },
          select: { id: true, redsysOrderId: true },
        });
        const paid = await tx.partyParticipation.findMany({
          where: {
            partyId,
            status: { in: ['PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
          },
          select: { id: true, redsysTransactionId: true },
        });
        await tx.partyParticipation.updateMany({
          where: { partyId, status: 'PENDING_PAYMENT' },
          data: { status: 'CANCELLED', slotNumber: null, reservationExpiresAt: null },
        });
        await tx.partyParticipation.updateMany({
          where: {
            partyId,
            status: { in: ['PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
          },
          data: {
            status: 'REFUND_REQUIRED',
            refundStatus: 'NONE',
            slotNumber: null,
          },
        });
        await tx.party.update({
          where: { id: partyId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            inventoryReleased: true,
            ...(!party.inventoryReleased
              ? { product: { update: { stock: { increment: 1 } } } }
              : {}),
          },
        });
        await tx.partyAuditLog.create({
          data: {
            partyId,
            action: 'CANCELLED',
            adminId: 'admin-cookie',
            details: { releasedInventory: !party.inventoryReleased },
          },
        });
        return {
          pendingPayments: pending,
          paidParticipations: paid,
        };
      });
      return NextResponse.json({
        success: true,
        pendingPaymentCount: cancellation.pendingPayments.length,
        refundFailures: cancellation.paidParticipations.map(({ id }) => id),
        manualRefundRequired: cancellation.paidParticipations.length > 0,
      });
    }

    if (body.action === 'start') {
      const tiktokLiveUrl = body.tiktokLiveUrl;
      if (
        typeof tiktokLiveUrl !== 'string' ||
        !isValidTikTokLiveUrl(tiktokLiveUrl)
      ) {
        return NextResponse.json(
          { error: 'Introduce una URL válida de TikTok LIVE (https://www.tiktok.com/@usuario/live).' },
          { status: 400 },
        );
      }
      await db.$transaction(async (tx) => {
        await lockPartyForUpdate(tx, partyId);
        const party = await tx.party.findUnique({
          where: { id: partyId },
          select: { status: true, participantCount: true },
        });
        if (!party) throw new Error('PARTY_NOT_FOUND');
        if (party.status !== 'FULL') throw new Error('PARTY_NOT_FULL');
        const now = new Date();
        await tx.partyParticipation.updateMany({
          where: {
            partyId,
            status: 'PENDING_PAYMENT',
            reservationExpiresAt: { lte: now },
          },
          data: { status: 'EXPIRED', slotNumber: null, reservationExpiresAt: null },
        });
        const participants = await tx.partyParticipation.findMany({
          where: { partyId, slotNumber: { not: null } },
          select: { status: true, refundStatus: true, paidAt: true, orderId: true },
        });
        const startError = getStartPartyError(party.participantCount, participants);
        if (startError) throw new Error('PARTY_NOT_READY');
        const unresolved = await tx.partyParticipation.count({
          where: {
            partyId,
            OR: [
              { refundStatus: 'REQUESTED' },
              { status: { in: ['PENDING_PAYMENT', 'REFUND_REQUIRED'] } },
            ],
          },
        });
        if (unresolved) throw new Error('PARTY_NOT_READY');
        const updated = await tx.party.updateMany({
          where: { id: partyId, status: 'FULL' },
          data: {
            status: 'IN_PROGRESS',
            tiktokLiveUrl,
            startedAt: now,
          },
        });
        if (updated.count !== 1) throw new Error('PARTY_NOT_FULL');
        await tx.partyAuditLog.create({
          data: {
            partyId,
            action: 'STARTED',
            adminId: 'admin-cookie',
            details: { tiktokLiveUrl },
          },
        });
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'finalize') {
      await db.$transaction(async (tx) => {
        await lockPartyForUpdate(tx, partyId);
        const party = await tx.party.findUnique({
          where: { id: partyId },
          select: { status: true, participantCount: true, mode: true },
        });
        if (!party) throw new Error('PARTY_NOT_FOUND');
        if (party.status !== 'IN_PROGRESS') throw new Error('PARTY_NOT_IN_PROGRESS');
        const isBattle = party.mode === 'BATTLE';
        if (isBattle && typeof body.winnerParticipationId !== 'string') {
          throw new Error('PARTY_WINNER_REQUIRED');
        }

        const participants = await tx.partyParticipation.findMany({
          where: { partyId, status: 'PAID', refundStatus: { in: ['NONE', 'REJECTED'] } },
          select: { id: true, status: true, refundStatus: true, paidAt: true, orderId: true },
        });
        if (participants.length !== party.participantCount || participants.some((p) => !p.orderId || !p.paidAt)) {
          throw new Error('PARTY_PARTICIPANTS_INVALID');
        }
        // Compartida has no winner: every participant keeps their own packs.
        const winner = isBattle
          ? participants.find((p) => p.id === body.winnerParticipationId)
          : null;
        if (isBattle && !winner) throw new Error('PARTY_INVALID_WINNER');
        const nonWinnerOrderIds = winner
          ? participants
              .filter((participant) => participant.id !== winner.id)
              .map((participant) => participant.orderId as string)
          : [];
        const updated = await tx.party.updateMany({
          where: { id: partyId, status: 'IN_PROGRESS' },
          data: {
            status: 'COMPLETED',
            winnerParticipationId: winner?.id ?? null,
            completedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw new Error('PARTY_NOT_IN_PROGRESS');
        if (nonWinnerOrderIds.length) {
          const ordersUpdated = await tx.order.updateMany({
            where: {
              id: { in: nonWinnerOrderIds },
              paymentStatus: 'PAID',
              status: 'PROCESSING',
            },
            data: { status: 'COMPLETED' },
          });
          if (ordersUpdated.count !== nonWinnerOrderIds.length) {
            throw new Error('PARTY_ORDER_STATUS_CONFLICT');
          }
        }
        await tx.partyAuditLog.create({
          data: {
            partyId,
            action: 'COMPLETED',
            adminId: 'admin-cookie',
            details: {
              winnerParticipationId: winner?.id ?? null,
              deliveredOrderIds: nonWinnerOrderIds,
            } as Prisma.InputJsonValue,
          },
        });
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'remove-participant') {
      if (typeof body.participationId !== 'string') {
        return NextResponse.json({ error: 'Participante no válido.' }, { status: 400 });
      }
      await db.$transaction(async (tx) => {
        await lockPartyForUpdate(tx, partyId);
        const removed = await tx.partyParticipation.updateMany({
          where: { id: body.participationId as string, partyId, status: 'PENDING_PAYMENT' },
          data: { status: 'CANCELLED', slotNumber: null, reservationExpiresAt: null },
        });
        if (removed.count !== 1) throw new Error('PARTY_PARTICIPANT_NOT_REMOVABLE');
        await tx.partyAuditLog.create({
          data: {
            partyId,
            action: 'PARTICIPANT_REMOVED',
            adminId: 'admin-cookie',
            details: { participationId: body.participationId as string },
          },
        });
        await updatePartyCapacityStatus(tx, partyId);
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'resolve-refund') {
      if (
        typeof body.participationId !== 'string' ||
        !['approve', 'reject'].includes(String(body.resolution))
      ) {
        return NextResponse.json({ error: 'Resolución de reembolso inválida.' }, { status: 400 });
      }
      const resolution = body.resolution as 'approve' | 'reject';
      if (resolution === 'reject') {
        await db.$transaction(async (tx) => {
          await lockPartyForUpdate(tx, partyId);
          const participation = await tx.partyParticipation.findFirst({
            where: { id: body.participationId as string, partyId, refundStatus: 'REQUESTED' },
            select: { id: true },
          });
          if (!participation) throw new Error('PARTY_REFUND_NOT_REQUESTED');
          await tx.partyParticipation.update({
            where: { id: participation.id },
            data: { status: 'PAID', refundStatus: 'REJECTED' },
          });
          await tx.partyAuditLog.create({
            data: {
              partyId,
              action: 'REFUND_REJECTED',
              adminId: 'admin-cookie',
              details: { participationId: participation.id },
            },
          });
          await updatePartyCapacityStatus(tx, partyId);
        });
        return NextResponse.json({ success: true });
      }

      const participation = await db.$transaction(async (tx) => {
        await lockPartyForUpdate(tx, partyId);
        const record = await tx.partyParticipation.findFirst({
          where: {
            id: body.participationId as string,
            partyId,
            OR: [
              { refundStatus: 'REQUESTED' },
              { status: 'REFUND_REQUIRED' },
            ],
          },
          select: { id: true, redsysTransactionId: true },
        });
        if (!record?.redsysTransactionId) throw new Error('PARTY_REFUND_NOT_REQUESTED');
        return { id: record.id };
      });
      await db.$transaction(async (tx) => {
        await lockPartyForUpdate(tx, partyId);
        const current = await tx.partyParticipation.findUnique({
          where: { id: participation.id },
          select: { status: true, redsysTransactionId: true },
        });
        if (current?.status === 'REFUNDED') return;
        if (
          !current?.redsysTransactionId ||
          !['REFUND_REQUIRED', 'REFUND_REQUESTED', 'PAID'].includes(current.status)
        ) {
          throw new Error('PARTY_REFUND_NOT_REQUESTED');
        }
        await tx.partyParticipation.update({
          where: { id: participation.id },
          data: {
            status: 'REFUNDED',
            refundStatus: 'APPROVED',
            slotNumber: null,
            reservationExpiresAt: null,
            refundedAt: new Date(),
          },
        });
        const refundedOrder = await tx.partyParticipation.findUnique({
          where: { id: participation.id },
          select: { orderId: true },
        });
        if (refundedOrder?.orderId) {
          await tx.order.updateMany({
            where: {
              id: refundedOrder.orderId,
              paymentStatus: 'PAID',
              status: 'PROCESSING',
            },
            data: { paymentStatus: 'CANCELLED', status: 'CANCELLED' },
          });
        }
        await tx.partyAuditLog.create({
          data: {
            partyId,
            action: 'REFUND_APPROVED',
            adminId: 'admin-cookie',
            details: {
              participationId: participation.id,
              provider: 'redsys',
              resolution: 'manually-refunded-in-redsys-portal',
            },
          },
        });
        await updatePartyCapacityStatus(tx, partyId);
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { status: number; message: string }> = {
        PARTY_NOT_FOUND: { status: 404, message: 'Party no encontrada.' },
        PARTY_CANCEL_NOT_ALLOWED: { status: 409, message: 'Solo se pueden cancelar Parties abiertas.' },
        PARTY_NOT_FULL: { status: 409, message: 'La Party no está completa.' },
        PARTY_NOT_READY: {
          status: 409,
          message: 'Hay participaciones sin pago confirmado o con un reembolso pendiente.',
        },
        PARTY_NOT_IN_PROGRESS: { status: 409, message: 'La Party no está iniciada.' },
        PARTY_PARTICIPANTS_INVALID: { status: 409, message: 'Hay participantes u órdenes no válidos.' },
        PARTY_INVALID_WINNER: { status: 400, message: 'El ganador debe ser un participante con pago confirmado.' },
        PARTY_WINNER_REQUIRED: { status: 400, message: 'Selecciona al participante con el mejor hit.' },
        PARTY_ORDER_STATUS_CONFLICT: { status: 409, message: 'No se pudieron completar las órdenes de los demás participantes.' },
        PARTY_REFUND_NOT_REQUESTED: { status: 409, message: 'La solicitud de reembolso ya no está pendiente.' },
        PARTY_PARTICIPANT_NOT_REMOVABLE: {
          status: 409,
          message: 'Solo se pueden quitar participantes con el pago pendiente.',
        },
      };
      const known = messages[error.message];
      if (known) return NextResponse.json({ error: known.message }, { status: known.status });
    }
    captureServerError({ error, module: 'admin_party_action_api', request, extra: { partyId } });
    return NextResponse.json({ error: 'No se pudo actualizar la Party.' }, { status: 500 });
  }
}
