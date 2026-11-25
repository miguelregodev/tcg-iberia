import { Prisma } from '@prisma/client';
import { calculateTaxExclusiveProducts } from './calculations';
import { getLoyaltyWindowStart } from './window';

type Tx = Prisma.TransactionClient;

const EXCLUDED_STATUSES = ['CANCELLED', 'FAILED', 'DEVUELTO'] as const;
const PRODUCT_TAX_RATE = '0.21';
const ZERO = new Prisma.Decimal(0);

/**
 * Product spend of an order paid before the loyalty program recorded it:
 * discounted product lines, without shipping and without VAT. The result is
 * capped at the amount actually charged. Unreadable snapshots count as 0.
 */
export function legacyOrderEligibleSpend(items: Prisma.JsonValue, totalAmount: Prisma.Decimal): Prisma.Decimal {
  if (!Array.isArray(items)) return ZERO;
  let gross = ZERO;
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ZERO;
    const { price, quantity, discountPercentage } = raw as Record<string, unknown>;
    if (typeof price !== 'number' || typeof quantity !== 'number' || !Number.isFinite(price) || !Number.isFinite(quantity) ||
        price < 0 || quantity <= 0) {
      return ZERO;
    }
    const discount = typeof discountPercentage === 'number' && discountPercentage > 0 ? Math.min(discountPercentage, 100) : 0;
    gross = gross.plus(new Prisma.Decimal(price).times(new Prisma.Decimal(100).minus(discount)).dividedBy(100).times(quantity));
  }
  const charged = Prisma.Decimal.min(gross, totalAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return charged.isNegative() ? ZERO : calculateTaxExclusiveProducts(charged, PRODUCT_TAX_RATE);
}

/**
 * Eligible spend for tier evaluation in the rolling window ending at `at`.
 * Includes orders rewarded by the program and paid orders of the same user
 * made before the program existed (no LoyaltyPurchase or reward). Party slots are not
 * product purchases and never count.
 */
export async function getQualifyingSpend(
  tx: Tx,
  input: { userId: string; accountId: string | null; at: Date; evaluationDays: number },
): Promise<Prisma.Decimal> {
  const from = getLoyaltyWindowStart(input.at, input.evaluationDays);
  const [rewards, legacyOrders] = await Promise.all([
    input.accountId ? tx.loyaltyOrderReward.findMany({
      where: {
        accountId: input.accountId,
        paidAt: { gte: from, lte: input.at },
        order: { paymentStatus: 'PAID', status: { notIn: [...EXCLUDED_STATUSES] } },
      },
      select: { eligibleSpend: true, refundedSpend: true },
    }) : Promise.resolve([]),
    tx.order.findMany({
      where: {
        userId: input.userId,
        paymentStatus: 'PAID',
        status: { notIn: [...EXCLUDED_STATUSES] },
        paymentPaidAt: { gte: from, lte: input.at },
        loyaltyPurchase: { is: null },
        // Legacy orders credited by the historical migration count through their reward.
        loyaltyReward: { is: null },
        partyParticipation: { is: null },
      },
      select: { items: true, totalAmount: true },
    }),
  ]);
  const rewarded = rewards.reduce((sum, reward) => sum.plus(reward.eligibleSpend).minus(reward.refundedSpend), ZERO);
  return legacyOrders.reduce((sum, order) => sum.plus(legacyOrderEligibleSpend(order.items, order.totalAmount)), rewarded);
}
