import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { isOrderItemSnapshot } from '@/lib/orders/items';
import { priceOrderItems, toShippingItems } from '@/lib/orders/pricing';
import { calculateSubtotal } from '@/lib/shipping/free-shipping';
import { resolveShippingCost } from '@/lib/shipping/resolve-shipping-cost';
import { SHIPPING_CONFIG } from '@/lib/shipping/config';
import {
  calculateEarnedPoints,
  calculateTaxExclusiveProducts,
  calculateTierProgress,
  resolveMaxRedemptionPoints,
  validateRedemption,
} from '@/lib/loyalty/calculations';
import { getLocalAccount } from '@/lib/loyalty/ledger';
import { isLoyaltyCheckoutEnabled } from '@/lib/loyalty/local-preview';
import { serializeTierTrack } from '@/lib/loyalty/presentation';

export async function POST(request: NextRequest) {
  if (!isLoyaltyCheckoutEnabled()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (!Array.isArray(input.items) || input.items.length === 0 || !input.items.every(isOrderItemSnapshot) ||
        typeof input.postalCode !== 'string' || typeof input.groupedShipping !== 'boolean' ||
        typeof input.redeemAll !== 'boolean') {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }

    const priced = await priceOrderItems(input.items);
    if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: 400 });
    const subtotal = calculateSubtotal(priced.items);
    const shipping = input.groupedShipping ? 0 : resolveShippingCost(
      toShippingItems(priced.items, priced.products), input.postalCode, subtotal, SHIPPING_CONFIG.freeShippingThreshold,
    );
    const total = new Prisma.Decimal(Math.round((subtotal + shipping) * 100)).dividedBy(100);
    const shippingGross = new Prisma.Decimal(shipping).toDecimalPlaces(2);
    const gross = total.minus(shippingGross);
    if (gross.isNegative() || total.lessThan('0.01')) return NextResponse.json({ error: 'Importe inválido.' }, { status: 400 });
    const data = await db.$transaction((tx) => getLocalAccount(tx, session.user.id, new Date()));
    const available = Prisma.Decimal.max(data.balance.minus(data.reserved), 0);
    const progress = calculateTierProgress(data.config.tiers, data.spending);
    const redemptionInput = {
      availablePoints: available,
      eligibleSubtotalGross: gross,
      eligibleSubtotalNet: calculateTaxExclusiveProducts(gross, '0.21'),
      paymentLimitGross: total.minus('0.01'),
      taxRate: '0.21',
    };
    const redemptionPolicy = {
      enabled: data.config.enabled,
      pointsPerEuro: data.config.pointsPerEuro,
      minimumPoints: data.config.minimumRedemption,
      incrementPoints: data.config.redemptionIncrement,
      maxDiscountPercent: data.config.maxDiscountPercent,
    };
    const pointsToRedeem = input.redeemAll
      ? resolveMaxRedemptionPoints(redemptionInput, redemptionPolicy)
      : new Prisma.Decimal(0);
    const discount = pointsToRedeem.greaterThan(0)
      ? validateRedemption({ ...redemptionInput, points: pointsToRedeem }, redemptionPolicy).gross
      : new Prisma.Decimal(0);
    const discountedGross = gross.minus(discount);
    const net = calculateTaxExclusiveProducts(discountedGross, '0.21');
    const paidTotal = total.minus(discount);
    // Points are earned on the order total before the points discount.
    const earnedPoints = calculateEarnedPoints(total, data.config.baseRate, progress.current.multiplier);
    const remainingAfterOrder = progress.next
      ? Prisma.Decimal.max(progress.remaining.minus(net), 0)
      : null;
    return NextResponse.json({
      available: available.toString(),
      reserved: data.reserved.toString(),
      pointsPerEuro: data.config.pointsPerEuro.toString(),
      minimum: data.config.minimumRedemption.toString(),
      increment: data.config.redemptionIncrement.toString(),
      tier: progress.current.name,
      multiplier: progress.current.multiplier.toString(),
      nextTier: progress.next?.name ?? null,
      remaining: progress.remaining.toString(),
      remainingAfterOrder: remainingAfterOrder?.toFixed(2) ?? null,
      earnedPoints: earnedPoints.toFixed(2),
      pointsToRedeem: pointsToRedeem.toFixed(2),
      progress: progress.percentage.toNumber(),
      tiers: serializeTierTrack(data.config.tiers),
      productGross: gross.toFixed(2),
      discount: discount.toFixed(2),
      shipping: shippingGross.toFixed(2),
      net: net.toFixed(2),
      vat: discountedGross.minus(net).toFixed(2),
      total: paidTotal.toFixed(2),
    });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_checkout_quote', request });
    return NextResponse.json({ error: 'No se pudo calcular la vista previa.' }, { status: 500 });
  }
}
