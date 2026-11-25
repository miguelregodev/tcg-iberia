import { Prisma } from '@prisma/client';
import { allocatePoints } from './lots';
import { calculateExpiration } from './expiration';
import { getQualifyingSpend } from './spending';

type Tx = Prisma.TransactionClient;
export class LoyaltyOperationError extends Error {}

export async function ledgerBalance(tx: Tx, accountId: string): Promise<Prisma.Decimal> {
  const result = await tx.loyaltyTransaction.aggregate({
    where: { accountId },
    _sum: { points: true },
  });
  return result._sum.points ?? new Prisma.Decimal(0);
}

export async function lockAccount(tx: Tx, userId: string): Promise<string> {
  const account = await tx.loyaltyAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${account.id} FOR UPDATE`);
  return account.id;
}

export async function expireLots(tx: Tx, accountId: string, balance: Prisma.Decimal, now: Date): Promise<Prisma.Decimal> {
  const lots = await tx.loyaltyPointsLot.findMany({
    where: { accountId, expiresAt: { lte: now }, remainingPoints: { gt: 0 } },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  for (const lot of lots) {
    balance = balance.minus(lot.remainingPoints);
    const transaction = await tx.loyaltyTransaction.create({
      data: {
        accountId,
        type: 'EXPIRATION',
        points: lot.remainingPoints.negated(),
        balanceAfter: balance,
        description: 'Caducidad de puntos',
        idempotencyKey: `expiration:${lot.id}`,
        expiresAt: lot.expiresAt,
      },
    });
    await tx.loyaltyPointsLot.update({ where: { id: lot.id }, data: { remainingPoints: 0 } });
    await tx.loyaltyLotAllocation.create({
      data: { lotId: lot.id, transactionId: transaction.id, points: lot.remainingPoints },
    });
  }
  return balance;
}

export interface ManualAdjustment {
  userId: string;
  adminActor: string;
  points: string;
  reason: string;
  idempotencyKey: string;
  now: Date;
}

/**
 * The caller must wrap this operation in one database transaction. The local
 * preview does not accept reservations until the payment lifecycle is complete.
 */
export async function applyManualAdjustment(tx: Tx, input: ManualAdjustment) {
  if (!input.adminActor.trim() || !/^-?\d+(?:\.\d{1,2})?$/.test(input.points) ||
      !input.reason.trim() || input.reason.trim().length > 2000 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey) ||
      !Number.isFinite(input.now.getTime())) {
    throw new LoyaltyOperationError('Datos del ajuste inválidos.');
  }
  const points = new Prisma.Decimal(input.points);
  if (points.isZero() || points.abs().greaterThan('9999999999.99')) throw new LoyaltyOperationError('Cantidad de puntos inválida.');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyProgramConfig" WHERE "id" = 'default' FOR SHARE`);
  const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (!config.enabled) throw new LoyaltyOperationError('El programa no está activado.');
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new LoyaltyOperationError('No se encontró el cliente.');
  const accountId = await lockAccount(tx, input.userId);
  const key = `adjustment:${input.adminActor}:${input.idempotencyKey}`;
  const existing = await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    if (existing.accountId !== accountId || !existing.points.equals(points) || existing.description !== input.reason.trim()) {
      throw new LoyaltyOperationError('La clave de ajuste ya se utilizó con otros datos.');
    }
    return existing;
  }
  const reservations = await tx.loyaltyRedemption.count({ where: { accountId, status: 'RESERVED' } });
  if (reservations > 0) throw new LoyaltyOperationError('No se puede ajustar una cuenta con reservas pendientes.');
  let balance = await ledgerBalance(tx, accountId);
  balance = await expireLots(tx, accountId, balance, input.now);

  const lots = points.isNegative()
    ? await tx.loyaltyPointsLot.findMany({ where: { accountId, remainingPoints: { gt: 0 } } })
    : [];
  if (points.isNegative() && balance.lessThan(points.abs())) {
    throw new LoyaltyOperationError('El cliente no dispone de suficientes puntos.');
  }
  const allocations = points.isNegative() ? allocatePoints(lots, points.abs(), balance, input.now) : [];
  const after = balance.plus(points);
  const newAvailable = Prisma.Decimal.max(after, 0).minus(Prisma.Decimal.max(balance, 0));
  const expiresAt = points.greaterThan(0) && newAvailable.greaterThan(0)
    ? calculateExpiration(input.now, config.expirationMonths)
    : null;
  const transaction = await tx.loyaltyTransaction.create({
    data: {
      accountId,
      adminActor: input.adminActor,
      type: 'ADMIN_ADJUSTMENT',
      points,
      balanceAfter: after,
      description: input.reason.trim(),
      idempotencyKey: key,
      expiresAt,
    },
  });
  for (const allocation of allocations) {
    await tx.loyaltyPointsLot.update({
      where: { id: allocation.lotId },
      data: { remainingPoints: { decrement: allocation.points } },
    });
    await tx.loyaltyLotAllocation.create({
      data: { lotId: allocation.lotId, transactionId: transaction.id, points: allocation.points },
    });
  }
  if (expiresAt) {
    await tx.loyaltyPointsLot.create({
      data: {
        accountId,
        transactionId: transaction.id,
        originalPoints: newAvailable,
        remainingPoints: newAvailable,
        expiresAt,
      },
    });
  }
  return transaction;
}

export async function getLocalAccount(tx: Tx, userId: string, now: Date) {
  const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({
    where: { id: 'default' },
    include: { tiers: { orderBy: { position: 'asc' } } },
  });
  if (!config.enabled) throw new Error('El programa no está activado.');
  const accountId = await lockAccount(tx, userId);
  const balance = await expireLots(tx, accountId, await ledgerBalance(tx, accountId), now);
  const [transactions, spending, reservations] = await Promise.all([
    tx.loyaltyTransaction.findMany({ where: { accountId }, orderBy: { sequence: 'desc' }, take: 100 }),
    getQualifyingSpend(tx, { userId, accountId, at: now, evaluationDays: config.evaluationDays }),
    tx.loyaltyRedemption.aggregate({ where: { accountId, status: 'RESERVED' }, _sum: { points: true } }),
  ]);
  const reserved = reservations._sum.points ?? new Prisma.Decimal(0);
  return { config, balance, reserved, transactions, spending };
}
