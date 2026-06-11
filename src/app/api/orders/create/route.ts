import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
        totalAmount: String(totalAmount),
        status: 'PROCESSING',
        stripeSessionId,
        items: items, // Store as JSON
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: 'Order created successfully',
    });
  } catch (error: unknown) {
    console.error('Order creation error:', error);
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
