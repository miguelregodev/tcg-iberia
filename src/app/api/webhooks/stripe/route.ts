import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';


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
  console.log("WEBHOOK HIT");
  console.log('HEADERS:', request.headers.get('content-type'));
  console.log('RAW BODY LENGTH:', body.length);
  
  console.log("SECRET:", webhookSecret?.slice(0, 10));
  const signature = request.headers.get('stripe-signature');
  console.log("SIGNATURE:", signature);
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
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    // Handle checkout session completed event
    console.log('Event type:', event.type);

    if (event.type === 'checkout.session.completed') {
      
      const session = event.data.object as Stripe.Checkout.Session;

      // Get session details including payment intent
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['payment_intent'],
      });

      const paymentIntent = expandedSession.payment_intent as Stripe.PaymentIntent;
      const metadata = paymentIntent?.metadata as SessionMetadata;

      console.log('Session:', session.id);
      console.log('PaymentIntent metadata:', paymentIntent?.metadata);
      console.log("METADATA SESSION:", session.metadata);

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
        // Create order only if we have customer data
        console.log('Generated orderNumber:', orderNumber);
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

          console.log('Order created:', order.id);
        } catch (err) {
          console.error('Prisma create failed', err);
        }
      } else {
        console.warn('Missing customer data for order creation:', { session: session.id, metadata });
      }
    }

    // Handle payment intent succeeded event (alternative event type)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = (paymentIntent.metadata || {}) as SessionMetadata;

      console.log('Payment intent succeeded:', paymentIntent.id);
      console.log('Metadata:', metadata);

      // If order wasn't already created via checkout.session.completed, create it here
      if (metadata.email && metadata.fullName) {
        const existingOrder = await db.order.findFirst({
          where: {
            stripeSessionId: paymentIntent.id,
          },
        });

        if (!existingOrder) {
          const items = (paymentIntent.charges.data[0]?.metadata || {}) as any;
          const orderNumber = await generateOrderNumber();

          await db.order.create({
            data: {
              orderNumber: orderNumber,
              fullName: metadata.fullName || 'Unknown',
              email: metadata.email || paymentIntent.receipt_email || '',
              phone: metadata.phone || '',
              shippingAddress: metadata.shippingAddress || '',
              shippingPostalCode: metadata.shippingPostalCode || '',
              shippingCity: metadata.shippingCity || '',
              shippingLocality: metadata.shippingLocality || '',
              shippingProvince: metadata.shippingProvince || '',
              totalAmount: new Prisma.Decimal((paymentIntent.amount || 0) / 100),
              status: 'PROCESSING',
              stripeSessionId: paymentIntent.id,
              items: items ? JSON.parse(items) : [],
            },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
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
