import { Prisma } from '@prisma/client';
import { calculateEarnedPoints, determineTier, type LoyaltyTier } from './calculations';
import { calculateExpiration } from './expiration';
import { expireLots, ledgerBalance, lockAccount, LoyaltyOperationError } from './ledger';
import { legacyOrderEligibleSpend } from './spending';
import { getLoyaltyWindowStart } from './window';

const BACKFILL_DAYS = 60;
const MAX_PREVIEW_ORDERS = 10000;
const EXCLUDED_STATUSES = new Set(['CANCELLED', 'FAILED', 'DEVUELTO']);
const EURO_CURRENCIES = new Set(['EUR', '978']);

const orderSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  createdAt: true,
  paymentPaidAt: true,
  paymentStatus: true,
  paymentAmount: true,
  paymentCurrency: true,
  totalAmount: true,
  status: true,
  items: true,
  partyParticipation: { select: { id: true } },
  loyaltyPurchase: { select: { eligibleSpend: true } },
  loyaltyReward: { select: { eligibleSpend: true, refundedSpend: true } },
  loyaltyTransactions: { where: { type: 'PURCHASE_REWARD' }, select: { id: true } },
  _count: { select: { loyaltyRefunds: true } },
} satisfies Prisma.OrderSelect;

type HistoricalOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

interface BackfillConfig {
  baseRate: Prisma.Decimal;
  evaluationDays: number;
  tiers: readonly LoyaltyTier[];
}

interface BackfillEntry {
  orderId: string;
  orderNumber: string;
  userId: string | null;
  paidAt: string | null;
  totalPaid: string;
  status: 'eligible' | 'review' | 'skipped';
  reason: string | null;
  tier?: string;
  multiplier?: string;
  priorSpend?: string;
  eligibleSpend?: string;
  points?: string;
}

function hasReadableItems(items: Prisma.JsonValue): boolean {
  return Array.isArray(items) && items.length > 0 && items.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const { price, quantity, discountPercentage } = item;
    return typeof price === 'number' && Number.isFinite(price) && price >= 0 &&
      typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0 &&
      (discountPercentage == null || (typeof discountPercentage === 'number' &&
        Number.isFinite(discountPercentage) && discountPercentage >= 0 && discountPercentage <= 100));
  });
}

function inspectOrder(order: HistoricalOrder) {
  if (order.paymentStatus !== 'PAID' || order.partyParticipation) {
    return { excluded: true, issue: 'No es una compra de productos pagada.', spending: null };
  }
  if (EXCLUDED_STATUSES.has(order.status)) {
    return { excluded: true, issue: 'Pedido cancelado, fallido o devuelto; requiere conciliar su efecto histórico.', spending: null };
  }
  let issue: string | null = null;
  if (!order.paymentPaidAt) issue = 'Falta una fecha de pago verificable.';
  else if (!order.userId) issue = 'Pedido sin cuenta vinculada; no se atribuye por coincidencia de email.';
  // Redsys stores the ISO 4217 numeric code (978) for euros.
  else if (!EURO_CURRENCIES.has(order.paymentCurrency ?? '') || !order.paymentAmount?.isFinite() ||
    !order.paymentAmount.greaterThan(0) || !order.paymentAmount.equals(order.totalAmount)) {
    issue = 'El importe cobrado o la moneda no están conciliados con el total.';
  } else if (order._count.loyaltyRefunds > 0 || order.loyaltyReward?.refundedSpend.greaterThan(0)) {
    issue = 'Hay reembolsos cuyo efecto histórico debe conciliarse.';
  } else if (order.loyaltyPurchase && !order.loyaltyReward) {
    issue = 'Compra del programa pendiente de conciliación; no se migra como pedido antiguo.';
  } else if (!order.loyaltyPurchase && !hasReadableItems(order.items)) {
    issue = 'No se puede reconstruir el gasto de productos a partir del pedido.';
  }
  const spending = issue ? null : order.loyaltyReward
    ? order.loyaltyReward.eligibleSpend
    : legacyOrderEligibleSpend(order.items, order.totalAmount);
  return { excluded: false, issue, spending };
}

/** Read-only plan: no accounts, rewards, lots or ledger entries are created. */
export function buildLoyaltyBackfillPreview(
  orders: readonly HistoricalOrder[],
  config: BackfillConfig,
  activationAt: Date,
) {
  if (!Number.isFinite(activationAt.getTime())) throw new Error('Fecha de activación inválida.');
  determineTier(config.tiers, '0');
  calculateEarnedPoints('0', config.baseRate, '1');
  const from = new Date(activationAt.getTime() - BACKFILL_DAYS * 86400000);
  getLoyaltyWindowStart(from, config.evaluationDays);
  const inspected = orders.map((order) => ({ order, ...inspectOrder(order) }));
  const byUser = new Map<string, typeof inspected>();
  for (const entry of inspected) {
    if (!entry.order.userId || entry.order.partyParticipation || entry.order.paymentStatus !== 'PAID') continue;
    const history = byUser.get(entry.order.userId) ?? [];
    history.push(entry);
    byUser.set(entry.order.userId, history);
  }

  const entries: BackfillEntry[] = [];
  let totalPoints = new Prisma.Decimal(0);
  const users = new Set<string>();
  for (const entry of inspected) {
    const { order } = entry;
    const paidAt = order.paymentPaidAt;
    if (paidAt && (paidAt < from || paidAt >= activationAt)) continue;
    if (!paidAt && order.createdAt >= activationAt) continue;
    const row: BackfillEntry = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      paidAt: paidAt?.toISOString() ?? null,
      totalPaid: order.totalAmount.toFixed(2),
      status: 'review',
      reason: entry.issue,
    };
    if (entry.excluded) row.status = 'skipped';
    else if (order.loyaltyReward || order.loyaltyTransactions.length > 0) {
      row.status = 'skipped';
      row.reason = 'Este pedido ya tiene una recompensa; no se vuelve a abonar.';
    } else if (!entry.issue && paidAt && order.userId) {
      const historyFrom = getLoyaltyWindowStart(paidAt, config.evaluationDays);
      const history = (byUser.get(order.userId) ?? []).filter(({ order: prior }) =>
        prior.id !== order.id && (!prior.paymentPaidAt ||
          (prior.paymentPaidAt >= historyFrom && prior.paymentPaidAt <= paidAt)));
      const uncertain = history.find((prior) => prior.issue || prior.order.paymentPaidAt?.getTime() === paidAt.getTime());
      if (uncertain) {
        row.reason = `No se puede reconstruir el nivel con certeza: revisar el pedido ${uncertain.order.orderNumber}.`;
      } else {
        const priorSpend = history.reduce((sum, prior) => {
          if (prior.spending === null) throw new Error('El histórico contiene un gasto pendiente de conciliación.');
          return sum.plus(prior.spending);
        }, new Prisma.Decimal(0));
        const tier = determineTier(config.tiers, priorSpend);
        const points = calculateEarnedPoints(order.totalAmount, config.baseRate, tier.multiplier);
        row.status = 'eligible';
        row.reason = null;
        row.tier = tier.name;
        row.multiplier = tier.multiplier.toString();
        row.priorSpend = priorSpend.toFixed(2);
        row.eligibleSpend = entry.spending?.toFixed(2);
        row.points = points.toFixed(0);
        totalPoints = totalPoints.plus(points);
        users.add(order.userId);
      }
    }
    entries.push(row);
  }
  return {
    dryRun: true,
    activationAt: activationAt.toISOString(),
    from: from.toISOString(),
    days: BACKFILL_DAYS,
    evaluationDays: config.evaluationDays,
    baseRate: config.baseRate.toString(),
    tiers: config.tiers.map((tier) => ({
      name: tier.name, threshold: tier.threshold.toString(), multiplier: tier.multiplier.toString(),
    })),
    summary: {
      eligibleOrders: entries.filter((entry) => entry.status === 'eligible').length,
      users: users.size,
      totalPoints: totalPoints.toFixed(0),
      reviewOrders: entries.filter((entry) => entry.status === 'review').length,
      skippedOrders: entries.filter((entry) => entry.status === 'skipped').length,
    },
    entries,
  };
}

async function loadBackfillOrders(tx: Prisma.TransactionClient, activationAt: Date, evaluationDays: number, userId?: string) {
  const from = new Date(activationAt.getTime() - BACKFILL_DAYS * 86400000);
  const historyFrom = getLoyaltyWindowStart(from, evaluationDays);
  const orders = await tx.order.findMany({
    where: {
      paymentStatus: 'PAID',
      ...(userId ? { userId } : {}),
      OR: [
        { paymentPaidAt: { gte: historyFrom, lt: activationAt } },
        { paymentPaidAt: null, createdAt: { lt: activationAt } },
      ],
    },
    select: orderSelect,
    orderBy: [{ paymentPaidAt: 'asc' }, { id: 'asc' }],
    take: MAX_PREVIEW_ORDERS + 1,
  });
  if (orders.length > MAX_PREVIEW_ORDERS) {
    throw new Error('La simulación supera los 10000 pedidos; requiere procesar el histórico por lotes antes de continuar.');
  }
  return orders;
}

export async function previewLoyaltyBackfill(tx: Prisma.TransactionClient, activationAt: Date) {
  const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({
    where: { id: 'default' },
    include: { tiers: { orderBy: { position: 'asc' } } },
  });
  const orders = await loadBackfillOrders(tx, activationAt, config.evaluationDays);
  return buildLoyaltyBackfillPreview(orders, config, activationAt);
}

export class LoyaltyBackfillAlreadyAppliedError extends LoyaltyOperationError {}

export interface LoyaltyBackfillResult {
  userId: string;
  /** Null while some orders still need review. */
  migratedAt: string | null;
  creditedOrders: number;
  points: string;
  balance: string;
  review: Array<{ orderNumber: string; reason: string | null }>;
}

/**
 * Credits the eligible orders of the last 60 days of one customer, each with
 * the tier the customer had right before that purchase, and marks the account
 * as migrated. Orders that need review are reported but never credited.
 * The caller must wrap it in one database transaction.
 */
export async function applyLoyaltyBackfillForUser(
  tx: Prisma.TransactionClient,
  input: { userId: string; adminActor: string; now: Date },
): Promise<LoyaltyBackfillResult> {
  if (!input.adminActor.trim() || !Number.isFinite(input.now.getTime())) {
    throw new LoyaltyOperationError('Datos de la migración inválidos.');
  }
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyProgramConfig" WHERE "id" = 'default' FOR SHARE`);
  const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({
    where: { id: 'default' },
    include: { tiers: { orderBy: { position: 'asc' } } },
  });
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new LoyaltyOperationError('No se encontró el cliente.');
  const accountId = await lockAccount(tx, input.userId);
  const account = await tx.loyaltyAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { historicalBackfillAt: true },
  });
  if (account.historicalBackfillAt) {
    throw new LoyaltyBackfillAlreadyAppliedError('La migración de puntos de este cliente ya se ejecutó.');
  }
  const reservations = await tx.loyaltyRedemption.count({ where: { accountId, status: 'RESERVED' } });
  if (reservations > 0) throw new LoyaltyOperationError('No se puede migrar una cuenta con canjes pendientes de pago.');

  const orders = await loadBackfillOrders(tx, input.now, config.evaluationDays, input.userId);
  const plan = buildLoyaltyBackfillPreview(orders, config, input.now);
  const before = await expireLots(tx, accountId, await ledgerBalance(tx, accountId), input.now);
  let balance = before;
  let credited = new Prisma.Decimal(0);
  const creditedOrders: string[] = [];

  for (const entry of plan.entries) {
    if (entry.status !== 'eligible' || entry.userId !== input.userId) continue;
    const paidAt = new Date(entry.paidAt!);
    const points = new Prisma.Decimal(entry.points!);
    const multiplier = new Prisma.Decimal(entry.multiplier!);
    await tx.loyaltyOrderReward.create({
      data: {
        orderId: entry.orderId,
        accountId,
        tierName: entry.tier!,
        multiplier,
        baseRate: config.baseRate,
        eligibleSpend: new Prisma.Decimal(entry.eligibleSpend!),
        pointsEarned: points,
        paidAt,
      },
    });
    creditedOrders.push(entry.orderNumber);
    if (points.isZero()) continue;
    const after = balance.plus(points);
    const availableAdded = Prisma.Decimal.max(after, 0).minus(Prisma.Decimal.max(balance, 0));
    const expiresAt = availableAdded.greaterThan(0) ? calculateExpiration(paidAt, config.expirationMonths) : null;
    const transaction = await tx.loyaltyTransaction.create({
      data: {
        accountId,
        orderId: entry.orderId,
        adminActor: input.adminActor,
        type: 'PURCHASE_REWARD',
        points,
        balanceAfter: after,
        description: `Puntos por compra anterior al programa (${entry.tier}, x${entry.multiplier})`,
        idempotencyKey: `backfill:${entry.orderId}`,
        eligibleSpend: new Prisma.Decimal(entry.eligibleSpend!),
        multiplier,
        expiresAt,
      },
    });
    if (expiresAt) {
      await tx.loyaltyPointsLot.create({
        data: { accountId, transactionId: transaction.id, originalPoints: availableAdded, remainingPoints: availableAdded, expiresAt },
      });
    }
    balance = after;
    credited = credited.plus(points);
  }
  // Points from purchases whose expiry already passed are recorded and expired in the ledger.
  balance = await expireLots(tx, accountId, balance, input.now);

  const review = plan.entries
    .filter((entry) => entry.status === 'review' && entry.userId === input.userId)
    .map((entry) => ({ orderNumber: entry.orderNumber, reason: entry.reason }));
  // With orders pending review the button stays available; already credited orders are skipped on retry.
  const completed = review.length === 0;
  if (completed) {
    await tx.loyaltyAccount.update({
      where: { id: accountId },
      data: { historicalBackfillAt: input.now, historicalBackfillBy: input.adminActor },
    });
  }
  await tx.loyaltyAdminAction.create({
    data: {
      adminActor: input.adminActor,
      action: 'HISTORICAL_BACKFILL',
      reason: `Migración de puntos de los pedidos de los últimos ${BACKFILL_DAYS} días`,
      before: { userId: input.userId, balance: before.toFixed(2) },
      after: {
        userId: input.userId,
        balance: balance.toFixed(2),
        points: credited.toFixed(0),
        from: plan.from,
        activationAt: plan.activationAt,
        creditedOrders,
        reviewOrders: review.map((entry) => entry.orderNumber),
      },
    },
  });
  return {
    userId: input.userId,
    migratedAt: completed ? input.now.toISOString() : null,
    creditedOrders: creditedOrders.length,
    points: credited.toFixed(0),
    balance: balance.toFixed(2),
    review,
  };
}
