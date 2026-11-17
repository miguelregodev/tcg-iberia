import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { sendLotteryParticipationDecisionEmail, sendLotteryWinnerEmail } from '@/lib/email';
import {
  canDeleteLottery,
  getLotteryEditMode,
  getLotteryTransition,
  getParticipationBlockReason,
  isOrderDateInLotteryRange,
  isRejectionReason,
  LOTTERY_LIMITS,
  pickWinnerIndex,
  REJECTION_REASON_LABELS,
  slugifyLotteryTitle,
  validateParticipationInput,
  type LotteryAction,
  type LotteryParticipationInput,
  type LotteryRejectionReason,
  type LotteryStatus,
  type LotteryWriteInput,
} from './core';

/** The admin panel authenticates with a shared password cookie, so audits use a fixed actor id. */
export const ADMIN_ACTOR_ID = 'admin-cookie';

type Tx = Prisma.TransactionClient;

export class LotteryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LotteryError';
  }
}

const PUBLIC_VISIBLE_STATUSES: LotteryStatus[] = ['SCHEDULED', 'ACTIVE', 'FINISHED', 'DRAWN', 'CANCELLED'];

// --- Shared helpers ---

async function lockLottery(tx: Tx, lotteryId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Lottery" WHERE "id" = ${lotteryId} FOR UPDATE`;
  if (rows.length === 0) throw new LotteryError('LOTTERY_NOT_FOUND', 'Sorteo no encontrado.', 404);
}

async function writeAudit(
  tx: Tx,
  entry: {
    lotteryId: string;
    participationId?: string | null;
    action: string;
    adminId: string | null;
    details?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await tx.lotteryAuditLog.create({
    data: {
      lotteryId: entry.lotteryId,
      participationId: entry.participationId ?? null,
      action: entry.action,
      adminId: entry.adminId,
      details: entry.details,
    },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Shows a public-safe name: first name and the initial of the last name. */
export function maskDisplayName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Participante';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// --- Status synchronization ---

/**
 * Moves lotteries forward when their dates pass: SCHEDULED to ACTIVE at start,
 * and SCHEDULED/ACTIVE to FINISHED at end. Each change is guarded by the previous
 * status so concurrent runs cannot apply it twice.
 */
export async function syncLotteryStatuses(now: Date = new Date()): Promise<void> {
  const due = await db.lottery.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED', startDate: { lte: now }, endDate: { gt: now } },
        { status: { in: ['SCHEDULED', 'ACTIVE'] }, endDate: { lte: now } },
      ],
    },
    select: { id: true, status: true, endDate: true },
  });

  for (const lottery of due) {
    const next: LotteryStatus = lottery.endDate.getTime() <= now.getTime() ? 'FINISHED' : 'ACTIVE';
    await db.$transaction(async (tx) => {
      const result = await tx.lottery.updateMany({
        where: { id: lottery.id, status: lottery.status },
        data: { status: next, ...(next === 'FINISHED' ? { finishedAt: now } : {}) },
      });
      if (result.count === 1) {
        await writeAudit(tx, {
          lotteryId: lottery.id,
          action: next === 'FINISHED' ? 'LOTTERY_FINISHED_AUTO' : 'LOTTERY_STARTED_AUTO',
          adminId: null,
          details: { previousStatus: lottery.status, nextStatus: next },
        });
      }
    });
  }
}

// --- Admin: lottery management ---

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugifyLotteryTitle(title) || 'sorteo';
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const exists = await db.lottery.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function createLottery(input: LotteryWriteInput, adminId: string) {
  const slug = await generateUniqueSlug(input.title);
  return db.$transaction(async (tx) => {
    const lottery = await tx.lottery.create({
      data: {
        title: input.title,
        slug,
        prize: input.prize,
        prizeImageUrl: input.prizeImageUrl,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        minimumOrderAmount: input.minimumOrderAmount,
        status: 'DRAFT',
        createdById: adminId,
      },
    });
    await writeAudit(tx, {
      lotteryId: lottery.id,
      action: 'LOTTERY_CREATED',
      adminId,
      details: { slug },
    });
    return lottery;
  });
}

export async function updateLottery(lotteryId: string, input: LotteryWriteInput, adminId: string) {
  return db.$transaction(async (tx) => {
    await lockLottery(tx, lotteryId);
    const current = await tx.lottery.findUniqueOrThrow({ where: { id: lotteryId } });
    const mode = getLotteryEditMode(current.status);

    if (mode === 'locked') {
      throw new LotteryError('LOTTERY_LOCKED', 'Este sorteo ya no se puede editar.', 409);
    }
    if (mode === 'active') {
      if (input.startDate.getTime() !== current.startDate.getTime()) {
        throw new LotteryError(
          'LOTTERY_LOCKED',
          'La fecha de inicio no se puede modificar una vez activo el sorteo.',
          409,
        );
      }
      if (input.endDate.getTime() <= Date.now()) {
        throw new LotteryError('INVALID_INPUT', 'La nueva fecha de fin debe ser futura.', 400);
      }
    }

    const updated = await tx.lottery.update({
      where: { id: lotteryId },
      data: {
        title: input.title,
        prize: input.prize,
        prizeImageUrl: input.prizeImageUrl,
        description: input.description,
        minimumOrderAmount: input.minimumOrderAmount,
        endDate: input.endDate,
        ...(mode === 'full' ? { startDate: input.startDate } : {}),
      },
    });
    await writeAudit(tx, {
      lotteryId,
      action: 'LOTTERY_UPDATED',
      adminId,
      details: { editMode: mode, status: current.status },
    });
    return updated;
  });
}

const ACTION_AUDIT: Record<LotteryAction, string> = {
  publish: 'LOTTERY_PUBLISHED',
  start: 'LOTTERY_STARTED',
  finish: 'LOTTERY_FINISHED',
  cancel: 'LOTTERY_CANCELLED',
};

export async function applyLotteryAction(lotteryId: string, action: LotteryAction, adminId: string) {
  return db.$transaction(async (tx) => {
    await lockLottery(tx, lotteryId);
    const current = await tx.lottery.findUniqueOrThrow({ where: { id: lotteryId } });
    const next = getLotteryTransition(action, current.status);
    if (!next) {
      throw new LotteryError(
        'INVALID_TRANSITION',
        'Esta acción no está disponible en el estado actual del sorteo.',
        409,
      );
    }
    const now = new Date();
    if (action === 'start' && current.endDate.getTime() <= now.getTime()) {
      throw new LotteryError('INVALID_TRANSITION', 'La fecha de fin del sorteo ya ha pasado.', 409);
    }

    const updated = await tx.lottery.update({
      where: { id: lotteryId },
      data: { status: next, ...(next === 'FINISHED' ? { finishedAt: now } : {}) },
    });
    await writeAudit(tx, {
      lotteryId,
      action: ACTION_AUDIT[action],
      adminId,
      details: { previousStatus: current.status, nextStatus: next },
    });
    return updated;
  });
}

export async function deleteLottery(lotteryId: string, adminId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockLottery(tx, lotteryId);
    const current = await tx.lottery.findUniqueOrThrow({ where: { id: lotteryId } });
    const participationCount = await tx.lotteryParticipation.count({ where: { lotteryId } });
    if (!canDeleteLottery(current.status, participationCount)) {
      throw new LotteryError(
        'LOTTERY_NOT_DELETABLE',
        'Solo se pueden eliminar sorteos en borrador o cancelados sin participaciones.',
        409,
      );
    }
    // Audit rows cascade with the lottery; the deletion itself is recorded in the server log.
    await tx.lottery.delete({ where: { id: lotteryId } });
    console.info(`[lottery] Deleted lottery ${lotteryId} (${current.slug}) by ${adminId}`);
  });
}

export async function listAdminLotteries() {
  await syncLotteryStatuses();
  const lotteries = await db.lottery.findMany({ orderBy: { startDate: 'desc' } });
  const counts = await db.lotteryParticipation.groupBy({
    by: ['lotteryId', 'status'],
    where: { lotteryId: { in: lotteries.map((lottery) => lottery.id) } },
    _count: { _all: true },
  });
  return lotteries.map((lottery) => {
    const summary = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of counts) {
      if (row.lotteryId === lottery.id) summary[row.status] = row._count._all;
    }
    return { ...lottery, participationCounts: summary };
  });
}

export async function getAdminLottery(lotteryId: string) {
  await syncLotteryStatuses();
  const lottery = await db.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      winnerParticipation: {
        select: { id: true, orderNumber: true, userEmailSnapshot: true, user: { select: { fullName: true } } },
      },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  return lottery;
}

export async function listLotteryParticipations(lotteryId: string, status?: string) {
  return db.lotteryParticipation.findMany({
    where: {
      lotteryId,
      ...(status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
        : {}),
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { submittedAt: 'desc' },
  });
}

// --- Public: lottery pages ---

export async function listPublicLotteries() {
  await syncLotteryStatuses();
  return db.lottery.findMany({
    where: { status: { in: PUBLIC_VISIBLE_STATUSES } },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      prize: true,
      prizeImageUrl: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });
}

export async function getPublicLotteryBySlug(slug: string) {
  await syncLotteryStatuses();
  const lottery = await db.lottery.findUnique({
    where: { slug },
    include: {
      winnerParticipation: { select: { id: true, user: { select: { fullName: true } } } },
    },
  });
  if (!lottery || !PUBLIC_VISIBLE_STATUSES.includes(lottery.status)) return null;
  return {
    id: lottery.id,
    title: lottery.title,
    slug: lottery.slug,
    prize: lottery.prize,
    prizeImageUrl: lottery.prizeImageUrl,
    description: lottery.description,
    startDate: lottery.startDate,
    endDate: lottery.endDate,
    minimumOrderAmount: lottery.minimumOrderAmount === null ? null : Number(lottery.minimumOrderAmount),
    status: lottery.status,
    winnerName: lottery.winnerParticipation ? maskDisplayName(lottery.winnerParticipation.user.fullName) : null,
  };
}

// --- Participation submission ---

export async function submitLotteryParticipation(params: {
  userId: string;
  slug: string;
  body: unknown;
  now?: Date;
}) {
  const parsed = validateParticipationInput(params.body);
  if (!parsed.ok) throw new LotteryError('INVALID_INPUT', parsed.error, 400);
  const input: LotteryParticipationInput = parsed.value;
  const now = params.now ?? new Date();

  const user = await db.user.findUnique({ where: { id: params.userId }, select: { email: true } });
  if (!user?.email) {
    throw new LotteryError('ACCOUNT_EMAIL_MISSING', 'Tu cuenta no tiene un correo válido.', 400);
  }

  try {
    return await db.$transaction(async (tx) => {
      const lottery = await tx.lottery.findUnique({ where: { slug: params.slug }, select: { id: true } });
      if (!lottery) throw new LotteryError('LOTTERY_NOT_FOUND', 'Sorteo no encontrado.', 404);

      // Lock first so the window, date range and duplicate checks see a consistent state.
      await lockLottery(tx, lottery.id);
      const current = await tx.lottery.findUniqueOrThrow({ where: { id: lottery.id } });

      const blocked = getParticipationBlockReason(current.status, current.startDate, current.endDate, now);
      if (blocked === 'NOT_STARTED') {
        throw new LotteryError('LOTTERY_NOT_STARTED', 'El sorteo todavía no ha comenzado.', 409);
      }
      if (blocked === 'ENDED') {
        throw new LotteryError(
          'LOTTERY_ENDED',
          '¡El sorteo ha finalizado! Los resultados se anunciarán en nuestro próximo directo de TikTok.',
          409,
        );
      }
      if (blocked) {
        throw new LotteryError('LOTTERY_NOT_OPEN', 'Este sorteo no admite participaciones en este momento.', 409);
      }

      if (!isOrderDateInLotteryRange(input.orderDate, current.startDate, current.endDate)) {
        throw new LotteryError(
          'ORDER_DATE_OUT_OF_RANGE',
          'Lo sentimos, la fecha del pedido no está dentro del rango de fechas permitido para este sorteo.',
          422,
        );
      }

      if (input.platform === 'WEBSITE') {
        const websiteOrder = await tx.order.findFirst({
          where: {
            orderNumber: input.normalizedOrderNumber,
            email: { equals: user.email, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (!websiteOrder) {
          throw new LotteryError(
            'ORDER_NOT_FOUND',
            'No encontramos un pedido web con ese número asociado a tu cuenta.',
            422,
          );
        }
      }

      const duplicate = await tx.lotteryParticipation.findUnique({
        where: {
          lotteryId_normalizedOrderNumber: {
            lotteryId: current.id,
            normalizedOrderNumber: input.normalizedOrderNumber,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new LotteryError(
          'DUPLICATE_ORDER',
          'Este número de pedido ya está registrado en este sorteo.',
          409,
        );
      }

      const participation = await tx.lotteryParticipation.create({
        data: {
          lotteryId: current.id,
          userId: params.userId,
          userEmailSnapshot: user.email,
          orderNumber: input.orderNumber,
          normalizedOrderNumber: input.normalizedOrderNumber,
          platform: input.platform,
          tiktokUsername: input.tiktokUsername,
          orderDate: new Date(`${input.orderDate}T00:00:00.000Z`),
          status: 'PENDING',
        },
        select: { id: true, status: true, submittedAt: true },
      });

      await writeAudit(tx, {
        lotteryId: current.id,
        participationId: participation.id,
        action: 'PARTICIPATION_SUBMITTED',
        adminId: null,
        details: { platform: input.platform, orderDate: input.orderDate },
      });
      return participation;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new LotteryError('DUPLICATE_ORDER', 'Este número de pedido ya está registrado en este sorteo.', 409);
    }
    throw error;
  }
}

// --- Admin: participation review ---

export type ReviewDecision = 'APPROVE' | 'REJECT';

export async function reviewLotteryParticipation(params: {
  lotteryId: string;
  participationId: string;
  decision: ReviewDecision;
  reason?: unknown;
  details?: unknown;
  adminId: string;
}) {
  let rejectionReason: LotteryRejectionReason | null = null;
  let rejectionDetails: string | null = null;

  if (params.decision === 'REJECT') {
    if (!isRejectionReason(params.reason)) {
      throw new LotteryError('INVALID_INPUT', 'Selecciona un motivo de rechazo.', 400);
    }
    rejectionReason = params.reason;
    const trimmed = typeof params.details === 'string' ? params.details.trim() : '';
    if (rejectionReason === 'OTHER' && !trimmed) {
      throw new LotteryError('INVALID_INPUT', 'Describe el motivo del rechazo.', 400);
    }
    if (trimmed.length > LOTTERY_LIMITS.rejectionDetailsMax) {
      throw new LotteryError('INVALID_INPUT', 'El texto del motivo es demasiado largo.', 400);
    }
    rejectionDetails = trimmed || null;
  }

  const result = await db.$transaction(async (tx) => {
    await lockLottery(tx, params.lotteryId);
    const lottery = await tx.lottery.findUniqueOrThrow({ where: { id: params.lotteryId } });
    if (lottery.status === 'DRAWN' || lottery.status === 'CANCELLED' || lottery.status === 'DRAFT') {
      throw new LotteryError(
        'LOTTERY_LOCKED',
        'Las participaciones de este sorteo ya no se pueden modificar.',
        409,
      );
    }

    const participation = await tx.lotteryParticipation.findFirst({
      where: { id: params.participationId, lotteryId: params.lotteryId },
    });
    if (!participation) throw new LotteryError('PARTICIPATION_NOT_FOUND', 'Participación no encontrada.', 404);

    if (params.decision === 'APPROVE' && participation.status === 'APPROVED') {
      throw new LotteryError('ALREADY_REVIEWED', 'La participación ya está aprobada.', 409);
    }
    if (params.decision === 'REJECT' && participation.status === 'REJECTED') {
      throw new LotteryError('ALREADY_REVIEWED', 'La participación ya está rechazada.', 409);
    }

    const nextStatus = params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await tx.lotteryParticipation.update({
      where: { id: participation.id },
      data: {
        status: nextStatus,
        reviewedById: params.adminId,
        reviewedAt: new Date(),
        rejectionReason,
        rejectionReasonDetails: rejectionDetails,
      },
    });

    await writeAudit(tx, {
      lotteryId: lottery.id,
      participationId: participation.id,
      action: params.decision === 'APPROVE' ? 'PARTICIPATION_APPROVED' : 'PARTICIPATION_REJECTED',
      adminId: params.adminId,
      details: {
        previousStatus: participation.status,
        orderNumber: participation.orderNumber,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });

    return { updated, lotteryTitle: lottery.title, lotteryUrl: `${appBaseUrl()}/sorteos/${lottery.slug}` };
  });

  // Emails are sent after commit so a failed send never rolls back the decision.
  await sendLotteryParticipationDecisionEmail({
    email: result.updated.userEmailSnapshot,
    lotteryTitle: result.lotteryTitle,
    lotteryUrl: result.lotteryUrl,
    decision: params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    rejectionReasonLabel: rejectionReason ? REJECTION_REASON_LABELS[rejectionReason] : null,
    rejectionDetails,
  });

  return result.updated;
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// --- Admin: winner draw ---

export async function drawLotteryWinner(lotteryId: string, adminId: string) {
  const result = await db.$transaction(async (tx) => {
    await lockLottery(tx, lotteryId);
    const lottery = await tx.lottery.findUniqueOrThrow({ where: { id: lotteryId } });

    if (lottery.status === 'DRAWN' || lottery.winnerParticipationId) {
      throw new LotteryError('WINNER_ALREADY_DRAWN', 'Este sorteo ya tiene ganador.', 409);
    }
    if (lottery.status !== 'FINISHED') {
      throw new LotteryError(
        'LOTTERY_NOT_FINISHED',
        'Solo se puede elegir ganador cuando el sorteo está finalizado.',
        409,
      );
    }

    const eligible = await tx.lotteryParticipation.findMany({
      where: { lotteryId, status: 'APPROVED' },
      orderBy: { id: 'asc' },
      select: { id: true, orderNumber: true, userId: true, userEmailSnapshot: true },
    });
    if (eligible.length === 0) {
      throw new LotteryError(
        'NO_ELIGIBLE_PARTICIPATIONS',
        'No hay participaciones aprobadas para elegir un ganador.',
        409,
      );
    }

    const winner = eligible[pickWinnerIndex(eligible.length)];
    const drawnAt = new Date();
    await tx.lottery.update({
      where: { id: lotteryId },
      data: {
        status: 'DRAWN',
        drawnAt,
        drawnById: adminId,
        eligibleCountAtDraw: eligible.length,
        winnerParticipationId: winner.id,
      },
    });
    await writeAudit(tx, {
      lotteryId,
      participationId: winner.id,
      action: 'WINNER_DRAWN',
      adminId,
      details: {
        eligibleCount: eligible.length,
        winnerParticipationId: winner.id,
        winnerUserId: winner.userId,
        winnerEmail: winner.userEmailSnapshot,
        orderNumber: winner.orderNumber,
      },
    });

    return {
      winnerParticipationId: winner.id,
      eligibleCount: eligible.length,
      drawnAt,
      winnerEmail: winner.userEmailSnapshot,
      lotteryTitle: lottery.title,
      prize: lottery.prize,
      lotteryUrl: `${appBaseUrl()}/sorteos/${lottery.slug}`,
    };
  });

  await sendLotteryWinnerEmail({
    email: result.winnerEmail,
    lotteryTitle: result.lotteryTitle,
    prize: result.prize,
    lotteryUrl: result.lotteryUrl,
  });

  return {
    winnerParticipationId: result.winnerParticipationId,
    eligibleCount: result.eligibleCount,
    drawnAt: result.drawnAt,
  };
}
