import { Prisma } from '@prisma/client';
import { calculateEarnedPoints, determineTier } from './calculations';
import { calculateExpiration } from './expiration';
import { expireLots, ledgerBalance, lockAccount, LoyaltyOperationError } from './ledger';
import { settleRedemption } from './redemption';
import { getQualifyingSpend } from './spending';

type Tx = Prisma.TransactionClient;

/** Call inside the transaction that confirms payment, with the order locked. */
export async function finalizeLoyaltyPurchase(tx: Tx, orderId: string) {
  const purchase = await tx.loyaltyPurchase.findUnique({ where: { orderId } });
  if (!purchase) return null;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { paymentStatus: true, paymentPaidAt: true, status: true },
  });
  if (order.paymentStatus !== 'PAID' || !order.paymentPaidAt || ['CANCELLED', 'FAILED', 'DEVUELTO'].includes(order.status)) {
    throw new LoyaltyOperationError('El pago del pedido no está confirmado.');
  }
  const paidAt = order.paymentPaidAt;
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyProgramConfig" WHERE "id" = 'default' FOR SHARE`);
  const config = await tx.loyaltyProgramConfig.findUniqueOrThrow({
    where: { id: 'default' },
    include: { tiers: { orderBy: { position: 'asc' } } },
  });
  const accountId = await lockAccount(tx, purchase.userId);
  const existing = await tx.loyaltyOrderReward.findUnique({ where: { orderId } });
  if (existing) return existing;
  const redemption = await tx.loyaltyRedemption.findUnique({ where: { orderId }, select: { id: true, discountGross: true } });
  if (redemption) await settleRedemption(tx, orderId, paidAt);
  const balance = await expireLots(tx, accountId, await ledgerBalance(tx, accountId), paidAt);
  const priorSpend = await getQualifyingSpend(tx, {
    userId: purchase.userId,
    accountId,
    at: paidAt,
    evaluationDays: config.evaluationDays,
  });
  const tier = determineTier(config.tiers, priorSpend);
  // The snapshot stores products after the points discount; points are earned on the order total before it.
  const orderTotal = purchase.productGross.plus(purchase.shippingGross).plus(redemption?.discountGross ?? 0);
  const points = calculateEarnedPoints(orderTotal, config.baseRate, tier.multiplier);
  const reward = await tx.loyaltyOrderReward.create({
    data: {
      orderId,
      accountId,
      tierName: tier.name,
      multiplier: tier.multiplier,
      baseRate: config.baseRate,
      eligibleSpend: purchase.eligibleSpend,
      pointsEarned: points,
      paidAt,
    },
  });
  if (!points.isZero()) {
    const after = balance.plus(points);
    const availableAdded = Prisma.Decimal.max(after, 0).minus(Prisma.Decimal.max(balance, 0));
    const expiresAt = availableAdded.greaterThan(0) ? calculateExpiration(paidAt, config.expirationMonths) : null;
    const entry = await tx.loyaltyTransaction.create({
      data: {
        accountId,
        orderId,
        type: 'PURCHASE_REWARD',
        points,
        balanceAfter: after,
        description: `Puntos por compra (${tier.name}, x${tier.multiplier.toString()})`,
        idempotencyKey: `purchase:${orderId}`,
        eligibleSpend: purchase.eligibleSpend,
        multiplier: tier.multiplier,
        expiresAt,
      },
    });
    if (expiresAt) {
      await tx.loyaltyPointsLot.create({
        data: { accountId, transactionId: entry.id, originalPoints: availableAdded, remainingPoints: availableAdded, expiresAt },
      });
    }
  }
  return reward;
}
