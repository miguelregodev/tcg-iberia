import { Prisma } from '@prisma/client';
import { validateRedemption } from './calculations';
import { expireLots, ledgerBalance, lockAccount, LoyaltyOperationError } from './ledger';
import { allocatePoints } from './lots';

type Tx = Prisma.TransactionClient;

interface ReserveRedemptionInput {
  userId: string;
  orderId: string;
  points: string;
  eligibleSubtotalGross: string;
  eligibleSubtotalNet: string;
  paymentLimitGross: string;
  taxRate: string;
  now: Date;
}

/**
 * The caller must pass server-priced amounts and create the order and payment
 * attempt in the same transaction. Points remain reserved until a verified
 * payment result or manual reconciliation; a timeout alone is not sufficient.
 */
export async function reserveRedemption(tx: Tx, input: ReserveRedemptionInput) {
  if (!Number.isFinite(input.now.getTime()) || !/^\d+(?:\.\d{1,2})?$/.test(input.points)) {
    throw new LoyaltyOperationError('Cantidad de puntos inválida.');
  }
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`);
  const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { userId: true, paymentStatus: true, status: true } });
  if (!order || order.userId !== input.userId || order.paymentStatus !== 'PENDING_PAYMENT' || order.status === 'CANCELLED') {
    throw new LoyaltyOperationError('El pedido no admite el canje.');
  }
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyProgramConfig" WHERE "id" = 'default' FOR SHARE`);
  const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({ where: { id: 'default' } });
  const accountId = await lockAccount(tx, input.userId);
  const existing = await tx.loyaltyRedemption.findUnique({ where: { orderId: input.orderId } });
  if (existing) throw new LoyaltyOperationError('El pedido ya tiene un canje.');
  const balance = await expireLots(tx, accountId, await ledgerBalance(tx, accountId), input.now);
  const reservations = await tx.loyaltyRedemption.aggregate({
    where: { accountId, status: 'RESERVED' },
    _sum: { points: true },
  });
  const available = Prisma.Decimal.max(balance.minus(reservations._sum.points ?? 0), 0);
  let discount;
  try {
    discount = validateRedemption({
      points: input.points,
      availablePoints: available,
      eligibleSubtotalGross: input.eligibleSubtotalGross,
      eligibleSubtotalNet: input.eligibleSubtotalNet,
      paymentLimitGross: input.paymentLimitGross,
      taxRate: input.taxRate,
    }, {
      enabled: config.enabled,
      pointsPerEuro: config.pointsPerEuro,
      minimumPoints: config.minimumRedemption,
      incrementPoints: config.redemptionIncrement,
      maxDiscountPercent: config.maxDiscountPercent,
    });
  } catch {
    throw new LoyaltyOperationError('El número de puntos no cumple las condiciones de canje o supera el saldo disponible.');
  }
  const lots = await tx.loyaltyPointsLot.findMany({ where: { accountId, remainingPoints: { gt: 0 } } });
  const allocations = allocatePoints(lots, input.points, available, input.now);
  const redemption = await tx.loyaltyRedemption.create({
    data: {
      accountId,
      orderId: input.orderId,
      points: input.points,
      discountGross: discount.gross,
      discountNet: discount.net,
    },
  });
  for (const allocation of allocations) {
    await tx.loyaltyPointsLot.update({
      where: { id: allocation.lotId },
      data: { remainingPoints: { decrement: allocation.points } },
    });
    await tx.loyaltyLotAllocation.create({
      data: { lotId: allocation.lotId, redemptionId: redemption.id, points: allocation.points },
    });
  }
  return redemption;
}

async function lockRedemptionAccount(tx: Tx, orderId: string) {
  const initial = await tx.loyaltyRedemption.findUnique({ where: { orderId }, select: { accountId: true } });
  if (!initial) throw new LoyaltyOperationError('No existe una reserva de puntos para el pedido.');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${initial.accountId} FOR UPDATE`);
  return tx.loyaltyRedemption.findUniqueOrThrow({ where: { orderId }, include: { allocations: { include: { lot: true } } } });
}

/** Call only within the transaction recording a verified successful payment. */
export async function settleRedemption(tx: Tx, orderId: string, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new LoyaltyOperationError('Fecha inválida.');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
  if (order?.paymentStatus !== 'PAID') throw new LoyaltyOperationError('El pago no está confirmado.');
  const redemption = await lockRedemptionAccount(tx, orderId);
  if (redemption.status === 'SETTLED') return redemption;
  if (redemption.status !== 'RESERVED') throw new LoyaltyOperationError('La reserva ya ha sido liberada.');
  const balance = await expireLots(tx, redemption.accountId, await ledgerBalance(tx, redemption.accountId), now);
  await tx.loyaltyTransaction.create({
    data: {
      accountId: redemption.accountId,
      orderId,
      type: 'REDEMPTION',
      points: redemption.points.negated(),
      balanceAfter: balance.minus(redemption.points),
      description: 'Canje de puntos en pedido',
      idempotencyKey: `redemption:${orderId}`,
    },
  });
  return tx.loyaltyRedemption.update({ where: { id: redemption.id }, data: { status: 'SETTLED' } });
}

/**
 * Call only after every payment attempt is known to have failed or been
 * cancelled. An abandoned or timed-out checkout is not proof of failure.
 */
export async function releaseRedemption(tx: Tx, orderId: string, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new LoyaltyOperationError('Fecha inválida.');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
  if (!order || !['PAYMENT_FAILED', 'CANCELLED'].includes(order.paymentStatus)) {
    throw new LoyaltyOperationError('El pago no ha finalizado.');
  }
  const redemption = await lockRedemptionAccount(tx, orderId);
  if (redemption.status === 'RELEASED') return redemption;
  if (redemption.status !== 'RESERVED') throw new LoyaltyOperationError('El canje ya ha sido liquidado.');
  let balance = await expireLots(tx, redemption.accountId, await ledgerBalance(tx, redemption.accountId), now);
  for (const allocation of redemption.allocations) {
    if (allocation.lot.expiresAt && allocation.lot.expiresAt <= now) {
      balance = balance.minus(allocation.points);
      const expired = await tx.loyaltyTransaction.create({
        data: {
          accountId: redemption.accountId,
          type: 'EXPIRATION',
          points: allocation.points.negated(),
          balanceAfter: balance,
          description: 'Caducidad de puntos liberados',
          idempotencyKey: `expiration:release:${redemption.id}:${allocation.lotId}`,
          expiresAt: allocation.lot.expiresAt,
        },
      });
      await tx.loyaltyLotAllocation.create({
        data: { lotId: allocation.lotId, transactionId: expired.id, points: allocation.points },
      });
    } else {
      await tx.loyaltyPointsLot.update({
        where: { id: allocation.lotId },
        data: { remainingPoints: { increment: allocation.points } },
      });
    }
  }
  return tx.loyaltyRedemption.update({ where: { id: redemption.id }, data: { status: 'RELEASED' } });
}
