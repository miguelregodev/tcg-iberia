import { Prisma } from '@prisma/client';
import { parseLoyaltyDecimal, type DecimalInput } from './calculations';

export interface SpendableLot {
  id: string;
  remainingPoints: DecimalInput;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface LotAllocation {
  lotId: string;
  points: Prisma.Decimal;
}

/**
 * Allocates only unexpired, unreserved points. The caller must lock the account,
 * pass the ledger's available balance and persist allocations atomically.
 */
export function allocatePoints(
  lots: readonly SpendableLot[],
  points: DecimalInput,
  availableBalance: DecimalInput,
  now: Date,
): LotAllocation[] {
  const requested = parseLoyaltyDecimal(points, 'Requested points');
  const balance = parseLoyaltyDecimal(availableBalance, 'Available balance');
  if (!Number.isFinite(now.getTime()) || !requested.greaterThan(0) || requested.decimalPlaces() > 2) {
    throw new Error('Invalid allocation amount or date');
  }
  if (balance.lessThan(requested)) throw new Error('Insufficient points');

  const seen = new Set<string>();
  const validated = lots.map((lot) => {
    const remaining = parseLoyaltyDecimal(lot.remainingPoints, 'Lot balance');
    if (
      !lot.id || seen.has(lot.id) || remaining.isNegative() || remaining.decimalPlaces() > 2 ||
      !Number.isFinite(lot.createdAt.getTime()) ||
      (lot.expiresAt !== null && !Number.isFinite(lot.expiresAt.getTime()))
    ) throw new Error('Invalid points lot');
    seen.add(lot.id);
    return { ...lot, remaining };
  });
  const eligible = validated
    .filter((lot) => lot.remaining.greaterThan(0) && (!lot.expiresAt || lot.expiresAt > now))
    .sort((a, b) => {
      if (a.expiresAt && !b.expiresAt) return -1;
      if (!a.expiresAt && b.expiresAt) return 1;
      const expiryDifference = a.expiresAt && b.expiresAt ? a.expiresAt.getTime() - b.expiresAt.getTime() : 0;
      return expiryDifference || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
    });

  let remaining = requested;
  const allocations: LotAllocation[] = [];
  for (const lot of eligible) {
    if (remaining.isZero()) break;
    const allocated = Prisma.Decimal.min(remaining, lot.remaining);
    allocations.push({ lotId: lot.id, points: allocated });
    remaining = remaining.minus(allocated);
  }
  if (!remaining.isZero()) throw new Error('Insufficient unexpired points');
  return allocations;
}

/**
 * Cumulative rounding avoids repeatedly rounding individual partial refunds.
 * The returned amount is only the additional reversal for this refund.
 */
export function proportionalPointReversal(
  totalPoints: DecimalInput,
  originalEligibleSpend: DecimalInput,
  cumulativeRefundedSpend: DecimalInput,
  alreadyReversed: DecimalInput,
): Prisma.Decimal {
  const points = parseLoyaltyDecimal(totalPoints, 'Total points');
  const spend = parseLoyaltyDecimal(originalEligibleSpend, 'Original eligible spend');
  const refunded = parseLoyaltyDecimal(cumulativeRefundedSpend, 'Refunded eligible spend');
  const reversed = parseLoyaltyDecimal(alreadyReversed, 'Previously reversed points');
  if (
    points.isNegative() || !spend.greaterThan(0) || refunded.isNegative() ||
    refunded.greaterThan(spend) || reversed.isNegative() || reversed.greaterThan(points) ||
    [points, spend, refunded, reversed].some((value) => value.decimalPlaces() > 2)
  ) throw new Error('Invalid refund amounts');

  const target = points.times(refunded).dividedBy(spend)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (target.lessThan(reversed)) throw new Error('Refund reversal exceeds cumulative entitlement');
  return target.minus(reversed);
}
