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

      // Get session details including payment intent
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['payment_intent'],
      });

      const paymentIntent = expandedSession.payment_intent as Stripe.PaymentIntent;
      const metadata = paymentIntent?.metadata as SessionMetadata;


      // Get line items from the session
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

      // Prepare items array
      const items = lineItems.data.map((item: any) => ({
        id: item.id,
        name: item.description || item.price?.product,
        quantity: item.quantity || 1,
        price: (item.price?.unit_amount || 0) / 100,
        discountPercentage: 0,
      }));

      

      if (metadata.email && metadata.fullName) {
          // Calculate total amount
        const totalAmount = (session.amount_total || 0) / 100;
        const orderNumber = await generateOrderNumber();

        try {
          const order = await db.order.create({
            data: {
              orderNumber: orderNumber,
              fullName: metadata.fullName || 'Unknown',
              email: metadata.email || session.customer_email || '',
              phone: metadata.phone || '',
              shippingAddress: metadata.shippingAddress || '',
              shippingPostalCode: metadata.shippingPostalCode || '',
              shippingCity: metadata.shippingCity || '',
              shippingLocality: metadata.shippingLocality || '',
              shippingProvince: metadata.shippingProvince || '',
              totalAmount: String(totalAmount),
              status: 'PROCESSING',
              stripeSessionId: session.id,
              items: items,
            },
          });

          // Fire-and-forget order emails. Failures are logged inside but never
          // break the webhook response — Stripe must always get a 2xx.
          try {
            await sendOrderEmails({
              orderNumber: order.orderNumber,
              fullName: order.fullName,
              email: order.email,
              phone: order.phone,
              totalAmount,
              items: items.map((it) => ({
                name: typeof it.name === 'string' ? it.name : 'Product',
                quantity: it.quantity,
                price: it.price,
                discountPercentage: it.discountPercentage,
              })),
              paymentStatus: session.payment_status || 'unknown',
              shipping: {
                address: order.shippingAddress,
                postalCode: order.shippingPostalCode,
                city: order.shippingCity,
                locality: order.shippingLocality,
                province: order.shippingProvince,
              },
            });
          } catch (mailErr) {
            console.error('[webhook] sendOrderEmails failed', mailErr);
            captureServerError({
              error: mailErr,
              module: 'background_order_email',
              request,
              orderId: order.id,
              userEmail: order.email,
            });
          }
        } catch (err) {
          console.error('Prisma create failed', err);
          captureServerError({
            error: err,
            module: 'stripe_webhook_db_create_order',
            request,
            userEmail: metadata.email,
            extra: {
              stripeSessionId: session.id,
            },
          });
        }
      } else {
        console.warn('Missing customer data for order creation:', { session: session.id, metadata });
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
