import { Prisma, type PrismaClient } from '@prisma/client';
import { determineTier } from './calculations';
import { applyManualAdjustment, expireLots, ledgerBalance, lockAccount, LoyaltyOperationError } from './ledger';
import { getQualifyingSpend } from './spending';

type Tx = Prisma.TransactionClient;

export class LoyaltyBalanceConflictError extends LoyaltyOperationError {}

export interface LoyaltyAccountRow {
  userId: string;
  email: string;
  fullName: string | null;
  balance: string;
  reserved: string;
  spending: string;
  tier: { name: string; multiplier: string; color: string };
  historicalBackfillAt: string | null;
}

export interface LoyaltyAccountPage {
  items: LoyaltyAccountRow[];
  total: number;
  page: number;
  pageSize: number;
}

const ZERO = new Prisma.Decimal(0);

/**
 * Read-only listing. The balance discounts lots that are already expired but
 * not yet written to the ledger, so it matches what `expireLots` would produce.
 * The tier is derived from the rolling-window spend, exactly as at checkout;
 * it cannot be assigned manually.
 */
export async function listLoyaltyAccounts(
  db: PrismaClient,
  input: { query: string; page: number; pageSize: number; now: Date },
): Promise<LoyaltyAccountPage> {
  const query = input.query.trim();
  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};
  const [config, users, total] = await Promise.all([
    db.loyaltyProgramConfig.findUniqueOrThrow({
      where: { id: 'default' },
      select: { evaluationDays: true, tiers: { orderBy: { position: 'asc' } } },
    }),
    db.user.findMany({
      where,
      orderBy: [{ email: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        email: true,
        fullName: true,
        loyaltyAccount: { select: { id: true, historicalBackfillAt: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  const accountIds = users.flatMap((user) => (user.loyaltyAccount ? [user.loyaltyAccount.id] : []));
  const spendingPromise = Promise.all(users.map((user) => getQualifyingSpend(db, {
    userId: user.id,
    accountId: user.loyaltyAccount?.id ?? null,
    at: input.now,
    evaluationDays: config.evaluationDays,
  })));
  const [ledger, expired, reserved] = accountIds.length
    ? await Promise.all([
        db.loyaltyTransaction.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _sum: { points: true } }),
        db.loyaltyPointsLot.groupBy({
          by: ['accountId'],
          where: { accountId: { in: accountIds }, expiresAt: { lte: input.now }, remainingPoints: { gt: 0 } },
          _sum: { remainingPoints: true },
        }),
        db.loyaltyRedemption.groupBy({
          by: ['accountId'],
          where: { accountId: { in: accountIds }, status: 'RESERVED' },
          _sum: { points: true },
        }),
      ])
    : [[], [], []];
  const ledgerById = new Map(ledger.map((row) => [row.accountId, row._sum.points ?? ZERO]));
  const expiredById = new Map(expired.map((row) => [row.accountId, row._sum.remainingPoints ?? ZERO]));
  const reservedById = new Map(reserved.map((row) => [row.accountId, row._sum.points ?? ZERO]));
  const spending = await spendingPromise;

  return {
    items: users.map((user, index) => {
      const id = user.loyaltyAccount?.id;
      const balance = id ? (ledgerById.get(id) ?? ZERO).minus(expiredById.get(id) ?? ZERO) : ZERO;
      const held = id ? reservedById.get(id) ?? ZERO : ZERO;
      const tier = determineTier(config.tiers, spending[index]);
      return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        balance: balance.toFixed(2),
        reserved: held.toFixed(2),
        spending: spending[index].toFixed(2),
        tier: { name: tier.name, multiplier: tier.multiplier.toString(), color: tier.color },
        historicalBackfillAt: user.loyaltyAccount?.historicalBackfillAt?.toISOString() ?? null,
      };
    }),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export interface BalanceUpdate {
  userId: string;
  adminActor: string;
  targetBalance: string;
  expectedBalance: string;
  idempotencyKey: string;
  now: Date;
}

/**
 * Sets an absolute balance by recording the difference as an audited
 * ADMIN_ADJUSTMENT. The caller must wrap it in one database transaction.
 * `expectedBalance` is the value the administrator saw; if the balance moved
 * meanwhile, the update is rejected instead of overwriting the change.
 */
export async function setLoyaltyBalance(tx: Tx, input: BalanceUpdate): Promise<{ balance: Prisma.Decimal }> {
  if (!/^\d{1,10}$/.test(input.targetBalance) || !/^-?\d+(?:\.\d{1,2})?$/.test(input.expectedBalance)) {
    throw new LoyaltyOperationError('Introduce un número entero de puntos (≥ 0).');
  }
  const target = new Prisma.Decimal(input.targetBalance);
  const accountId = await lockAccount(tx, input.userId);
  const previous = await tx.loyaltyTransaction.findUnique({
    where: { idempotencyKey: `adjustment:${input.adminActor}:${input.idempotencyKey}` },
    select: { accountId: true, balanceAfter: true },
  });
  if (previous) {
    if (previous.accountId !== accountId || !previous.balanceAfter.equals(target)) {
      throw new LoyaltyOperationError('La clave de ajuste ya se utilizó con otros datos.');
    }
    return { balance: previous.balanceAfter };
  }
  const current = await expireLots(tx, accountId, await ledgerBalance(tx, accountId), input.now);
  if (!current.equals(new Prisma.Decimal(input.expectedBalance))) {
    throw new LoyaltyBalanceConflictError('El saldo ha cambiado mientras lo editabas. Recarga la tabla e inténtalo de nuevo.');
  }
  const delta = target.minus(current);
  if (delta.isZero()) return { balance: current };
  const transaction = await applyManualAdjustment(tx, {
    userId: input.userId,
    adminActor: input.adminActor,
    points: delta.toFixed(2),
    reason: `Ajuste manual de saldo desde el backoffice (${current.toFixed(2)} → ${target.toFixed(0)} puntos)`,
    idempotencyKey: input.idempotencyKey,
    now: input.now,
  });
  return { balance: transaction.balanceAfter };
}
