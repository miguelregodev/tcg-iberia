import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { captureServerError } from '@/lib/observability/sentry';
import { isOrderItemSnapshot } from '@/lib/orders/items';
import { priceOrderItems, toShippingItems } from '@/lib/orders/pricing';
import { calculateSubtotal } from '@/lib/shipping/free-shipping';
import { resolveShippingCost } from '@/lib/shipping/resolve-shipping-cost';

interface CreateOrderRequest {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingLocality: string;
  shippingProvince: string;
  totalAmount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    discountPercentage?: number;
  }>;
  stripeSessionId?: string;
}

export async function POST(request: NextRequest) {
  let userEmail: string | undefined;

  try {
    const body = await request.json() as CreateOrderRequest;

    const {
      fullName,
      email,
      phone,
      shippingAddress,
      shippingPostalCode,
      shippingCity,
      shippingLocality,
      shippingProvince,
      totalAmount,
      items,
      stripeSessionId,
    } = body;

    userEmail = email;

    // Validate required fields
    if (
      !fullName ||
      !email ||
      !phone ||
      !shippingAddress ||
      !shippingPostalCode ||
      !shippingCity ||
      !shippingLocality ||
      !shippingProvince ||
      totalAmount === undefined ||
      !items || items.length === 0
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!items.every(isOrderItemSnapshot)) {
      return NextResponse.json({ error: 'Invalid order items' }, { status: 400 });
    }

    // Client prices and totals are never trusted: recompute them from the database.
    const priced = await priceOrderItems(items);
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: 400 });
    }
    const subtotal = calculateSubtotal(priced.items);
    const verifiedTotal =
      subtotal +
      resolveShippingCost(toShippingItems(priced.items, priced.products), shippingPostalCode, subtotal);

    // Create order in database
    const order = await db.order.create({
      data: {
        orderNumber: await generateOrderNumber(),
        fullName,
        email,
        phone,
        shippingAddress,
        shippingPostalCode,
        shippingCity,
        shippingLocality,
        shippingProvince,
        totalAmount: String(verifiedTotal),
        status: 'PROCESSING',
        stripeSessionId,
        items: priced.items as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: 'Order created successfully',
    });
  } catch (error: unknown) {
    console.error('Order creation error:', error);
    captureServerError({
      error,
      module: 'orders_create_api',
      request,
      userEmail,
    });
    const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
  function buildTimestamp(): string {
    const now = new Date();

    const pad = (n: number) => String(n).padStart(2, '0');

    return (
        now.getFullYear().toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '-' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds())
    );
  }

  async function getNextOrderSequence() {
    const result = await db.sequence.update({
        where: { name: 'ORDER' },
        data: {
            value: { increment: 1 },
        },
    });

    return result.value;
}

  async function generateOrderNumber(): Promise<string> {
    const sequence = await getNextOrderSequence();

    const timestamp = buildTimestamp();

    const sequenceStr = String(sequence).padStart(6, '0');

    return `TCG-${timestamp}-${sequenceStr}`;
  }
}
