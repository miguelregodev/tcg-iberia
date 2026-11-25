import { Prisma } from '@prisma/client';

export type DecimalInput = string | Prisma.Decimal;

export interface LoyaltyTier {
  name: string;
  threshold: DecimalInput;
  multiplier: DecimalInput;
}

function decimal(value: DecimalInput, label: string): Prisma.Decimal {
  const result = new Prisma.Decimal(value);
  if (!result.isFinite()) throw new Error(`${label} must be finite`);
  return result;
}
export { decimal as parseLoyaltyDecimal };

/**
 * Tiers must be supplied in progression order. Spending is a tax-exclusive
 * product amount provided by the order pricing system, not an order total.
 */
export function determineTier<T extends LoyaltyTier>(
  tiers: readonly T[],
  eligibleSpending: DecimalInput,
): T {
  const spending = decimal(eligibleSpending, 'Eligible spending');
  if (spending.isNegative()) throw new Error('Eligible spending cannot be negative');
  if (tiers.length === 0) throw new Error('At least one tier is required');

  const names = new Set<string>();
  let previousThreshold: Prisma.Decimal | undefined;
  let current = tiers[0];

  for (const tier of tiers) {
    const name = tier.name.trim().toLocaleLowerCase('es');
    const threshold = decimal(tier.threshold, 'Tier threshold');
    const multiplier = decimal(tier.multiplier, 'Tier multiplier');
    if (!name || names.has(name)) throw new Error('Tier names must be unique and non-empty');
    if (!multiplier.greaterThan(0)) throw new Error('Tier multiplier must be positive');
    if (
      previousThreshold === undefined
        ? !threshold.isZero()
        : threshold.lessThanOrEqualTo(previousThreshold)
    ) {
      throw new Error('Tier thresholds must start at zero and strictly increase');
    }

    names.add(name);
    previousThreshold = threshold;
    if (spending.greaterThanOrEqualTo(threshold)) current = tier;
  }

  return current;
}

/**
 * The caller supplies the tier before this order and the final amount paid,
 * including tax and shipping, after all discounts. Fractional points are
 * discarded once per order, after applying the rate and tier multiplier.
 */
export function calculateEarnedPoints(
  paidTotal: DecimalInput,
  baseRate: DecimalInput,
  tierMultiplier: DecimalInput,
): Prisma.Decimal {
  const spend = decimal(paidTotal, 'Paid total');
  const rate = decimal(baseRate, 'Base rate');
  const multiplier = decimal(tierMultiplier, 'Tier multiplier');
  if (spend.isNegative()) throw new Error('Paid total cannot be negative');
  if (!rate.greaterThan(0) || !multiplier.greaterThan(0)) {
    throw new Error('Point rate and tier multiplier must be positive');
  }

  return spend.times(rate).times(multiplier).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
}

export interface TierProgress<T extends LoyaltyTier> {
  current: T;
  next: T | null;
  spending: Prisma.Decimal;
  remaining: Prisma.Decimal;
  percentage: Prisma.Decimal;
}

export function calculateTierProgress<T extends LoyaltyTier>(
  tiers: readonly T[],
  eligibleSpending: DecimalInput,
): TierProgress<T> {
  const current = determineTier(tiers, eligibleSpending);
  const spending = decimal(eligibleSpending, 'Eligible spending');
  const next = tiers[tiers.indexOf(current) + 1] ?? null;
  if (!next) {
    return { current, next, spending, remaining: new Prisma.Decimal(0), percentage: new Prisma.Decimal(100) };
  }

  const threshold = decimal(next.threshold, 'Tier threshold');
  const previous = decimal(current.threshold, 'Tier threshold');
  const percentage = spending.minus(previous).dividedBy(threshold.minus(previous)).times(100);
  return {
    current,
    next,
    spending,
    remaining: threshold.minus(spending),
    percentage: Prisma.Decimal.min(
      percentage.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      new Prisma.Decimal('99.99'),
    ),
  };
}

export interface RedemptionPolicy {
  enabled: boolean;
  pointsPerEuro: DecimalInput;
  minimumPoints: DecimalInput;
  incrementPoints: DecimalInput;
  maxDiscountPercent: DecimalInput;
}

/**
 * Gross products already include tax and all non-loyalty discounts; shipping
 * must not be included. The rate is supplied by the order pricing system.
 */
export function calculateTaxExclusiveProducts(
  grossProducts: DecimalInput,
  taxRate: DecimalInput,
): Prisma.Decimal {
  const gross = decimal(grossProducts, 'Gross product amount');
  const tax = decimal(taxRate, 'Tax rate');
  if (gross.isNegative() || gross.decimalPlaces() > 2 || tax.isNegative()) {
    throw new Error('Invalid product amount or tax rate');
  }
  return gross.dividedBy(tax.plus(1)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface RedemptionInput {
  points: DecimalInput;
  availablePoints: DecimalInput;
  eligibleSubtotalNet: DecimalInput;
  eligibleSubtotalGross: DecimalInput;
  paymentLimitGross: DecimalInput;
  taxRate: DecimalInput;
}

export interface RedemptionDiscount {
  gross: Prisma.Decimal;
  net: Prisma.Decimal;
  tax: Prisma.Decimal;
}

/**
 * Point conversion is a gross discount. The cap applies to the net product
 * subtotal. The caller must compute paymentLimitGross from the payment minimum.
 */
export function validateRedemption(
  input: RedemptionInput,
  policy: RedemptionPolicy,
): RedemptionDiscount {
  if (!policy.enabled) throw new Error('Loyalty redemption is disabled');
  const requested = decimal(input.points, 'Requested points');
  const available = decimal(input.availablePoints, 'Available points');
  const subtotal = decimal(input.eligibleSubtotalNet, 'Eligible subtotal');
  const subtotalGross = decimal(input.eligibleSubtotalGross, 'Eligible gross subtotal');
  const limit = decimal(input.paymentLimitGross, 'Payment limit');
  const taxRate = decimal(input.taxRate, 'Tax rate');
  const conversion = decimal(policy.pointsPerEuro, 'Points per euro');
  const minimum = decimal(policy.minimumPoints, 'Minimum points');
  const increment = decimal(policy.incrementPoints, 'Points increment');
  const percent = decimal(policy.maxDiscountPercent, 'Maximum discount percent');

  if (
    !conversion.greaterThan(0) || !minimum.greaterThan(0) ||
    !increment.greaterThan(0) || percent.lessThan(0) || percent.greaterThan(100) ||
    minimum.decimalPlaces() > 2 || increment.decimalPlaces() > 2
  ) throw new Error('Invalid redemption policy');
  if (
    requested.decimalPlaces() > 2 || !requested.greaterThan(0) ||
    requested.lessThan(minimum) || !requested.modulo(increment).isZero()
  ) throw new Error('Invalid redemption amount');
  if (available.isNegative() || requested.greaterThan(available)) throw new Error('Insufficient points');
  if (
    subtotal.isNegative() || subtotalGross.isNegative() || limit.isNegative() ||
    subtotal.decimalPlaces() > 2 || subtotalGross.decimalPlaces() > 2 ||
    limit.decimalPlaces() > 2 || taxRate.isNegative()
  ) throw new Error('Invalid redemption limit or tax rate');

  const gross = requested.dividedBy(conversion);
  if (gross.decimalPlaces() > 2) throw new Error('Redemption must resolve to whole cents');
  const net = gross.dividedBy(taxRate.plus(1)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const percentageLimit = subtotal.times(percent).dividedBy(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  if (!net.greaterThan(0) || net.greaterThan(percentageLimit) || gross.greaterThan(subtotalGross) || gross.greaterThan(limit)) {
    throw new Error('Redemption exceeds the allowed discount');
  }
  return { gross, net, tax: gross.minus(net) };
}

/**
 * Largest redeemable amount (a valid increment multiple) for the order, or zero
 * when no amount passes validateRedemption. Starts from an upper bound and steps
 * down, so the result always matches what validateRedemption accepts.
 */
export function resolveMaxRedemptionPoints(
  input: Omit<RedemptionInput, 'points'>,
  policy: RedemptionPolicy,
): Prisma.Decimal {
  if (!policy.enabled) return new Prisma.Decimal(0);
  const available = decimal(input.availablePoints, 'Available points');
  const conversion = decimal(policy.pointsPerEuro, 'Points per euro');
  const minimum = decimal(policy.minimumPoints, 'Minimum points');
  const increment = decimal(policy.incrementPoints, 'Points increment');
  const percent = decimal(policy.maxDiscountPercent, 'Maximum discount percent');
  const subtotal = decimal(input.eligibleSubtotalNet, 'Eligible subtotal');
  const subtotalGross = decimal(input.eligibleSubtotalGross, 'Eligible gross subtotal');
  const limit = decimal(input.paymentLimitGross, 'Payment limit');
  const taxRate = decimal(input.taxRate, 'Tax rate');
  if (!conversion.greaterThan(0) || !increment.greaterThan(0)) return new Prisma.Decimal(0);

  const percentageLimit = subtotal.times(percent).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const grossUpperBound = Prisma.Decimal.min(
    subtotalGross,
    limit,
    percentageLimit.plus('0.01').times(taxRate.plus(1)),
  );
  const ceiling = Prisma.Decimal.min(available, grossUpperBound.times(conversion))
    .dividedBy(increment).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN).times(increment);

  let points = ceiling;
  while (points.greaterThanOrEqualTo(minimum) && points.greaterThan(0)) {
    try {
      validateRedemption({ ...input, points }, policy);
      return points;
    } catch {
      points = points.minus(increment);
    }
  }
  return new Prisma.Decimal(0);
}
