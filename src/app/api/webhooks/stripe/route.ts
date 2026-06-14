import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendOrderEmails } from '@/lib/email';
import { captureServerError } from '@/lib/observability/sentry';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

interface SessionMetadata {
  fullName?: string;
  email?: string;
  phone?: string;
  shippingAddress?: string;
  shippingPostalCode?: string;
  shippingCity?: string;
  shippingLocality?: string;
  shippingProvince?: string;
}

interface PersistedCheckoutItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number;
}

function isPersistedCheckoutItem(value: unknown): value is PersistedCheckoutItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.price === 'number'
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    captureServerError({
      error: err,
      module: 'stripe_webhook_signature',
      request,
    });
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['payment_intent'],
      });

      const paymentIntent = expandedSession.payment_intent as Stripe.PaymentIntent;
      const metadata = (paymentIntent?.metadata ?? {}) as SessionMetadata;

      const persistedCart = await db.checkoutSessionCart.findUnique({
        where: { sessionId: session.id },
        select: { items: true },
      });

      if (!persistedCart) {
        throw new Error(`No persisted checkout cart found for session ${session.id}`);
      }

      const rawItems = persistedCart.items as unknown;
      if (!Array.isArray(rawItems) || rawItems.length === 0 || !rawItems.every(isPersistedCheckoutItem)) {
        throw new Error(`Persisted cart is invalid for session ${session.id}`);
      }
      const items = rawItems;

      const totalAmount = (session.amount_total || 0) / 100;
      const customerEmail = (metadata.email || session.customer_email || '').toLowerCase();
      const customerName = metadata.fullName || 'Cliente';

      const linkedUser = customerEmail
        ? await db.user.findUnique({
            where: { email: customerEmail },
            select: { id: true },
          })
        : null;

      let orderRecord: { id: string; orderNumber: string; email: string; fullName: string; phone: string; shippingAddress: string; shippingPostalCode: string; shippingCity: string; shippingLocality: string; shippingProvince: string } | null = null;
      let orderCreated = false;

      try {
        orderRecord = await db.$transaction(async (tx) => {
          const existing = await tx.order.findFirst({
            where: { stripeSessionId: session.id },
            select: {
              id: true,
              orderNumber: true,
              email: true,
              fullName: true,
              phone: true,
              shippingAddress: true,
              shippingPostalCode: true,
              shippingCity: true,
              shippingLocality: true,
              shippingProvince: true,
            },
          });

          if (existing) return existing;

          for (const item of items) {
            if (!item.id || !item.quantity || item.quantity <= 0) {
              throw new Error(`Invalid item payload in checkout cart for session ${session.id}`);
            }

            const updateStock = await tx.product.updateMany({
              where: {
                id: item.id,
                stock: { gte: item.quantity },
              },
              data: {
                stock: { decrement: item.quantity },
              },
            });

            if (updateStock.count === 0) {
              throw new Error(`Insufficient stock for product ${item.id}`);
            }
          }

          const created = await tx.order.create({
            data: {
              orderNumber: await generateOrderNumber(),
              userId: linkedUser?.id ?? null,
              fullName: customerName,
              email: customerEmail,
              phone: metadata.phone || '',
              shippingAddress: metadata.shippingAddress || '',
              shippingPostalCode: metadata.shippingPostalCode || '',
              shippingCity: metadata.shippingCity || '',
              shippingLocality: metadata.shippingLocality || '',
              shippingProvince: metadata.shippingProvince || '',
              totalAmount: String(totalAmount),
              status: 'PROCESSING',
              stripeSessionId: session.id,
              items: items as unknown as Prisma.InputJsonValue,
            },
            select: {
              id: true,
              orderNumber: true,
              email: true,
              fullName: true,
              phone: true,
              shippingAddress: true,
              shippingPostalCode: true,
              shippingCity: true,
              shippingLocality: true,
              shippingProvince: true,
            },
          });

          await tx.checkoutSessionCart.update({
            where: { sessionId: session.id },
            data: { processedAt: new Date() },
          });

          orderCreated = true;
          return created;
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Unique constraint on stripeSessionId protects idempotency.
          return NextResponse.json({ received: true });
        }

        captureServerError({
          error,
          module: 'stripe_webhook_inventory_or_order_tx',
          request,
          userEmail: customerEmail,
          extra: { stripeSessionId: session.id },
        });

        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
      }

      if (orderCreated && orderRecord) {
        try {
          await sendOrderEmails({
            orderNumber: orderRecord.orderNumber,
            fullName: orderRecord.fullName,
            email: orderRecord.email,
            phone: orderRecord.phone,
            totalAmount,
            items: items.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: it.price,
              discountPercentage: it.discountPercentage,
            })),
            paymentStatus: session.payment_status || 'unknown',
            shipping: {
              address: orderRecord.shippingAddress,
              postalCode: orderRecord.shippingPostalCode,
              city: orderRecord.shippingCity,
              locality: orderRecord.shippingLocality,
              province: orderRecord.shippingProvince,
            },
          });
        } catch (mailErr) {
          captureServerError({
            error: mailErr,
            module: 'background_order_email',
            request,
            orderId: orderRecord.id,
            userEmail: orderRecord.email,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    captureServerError({
      error,
      module: 'stripe_webhook_processing',
      request,
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
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
