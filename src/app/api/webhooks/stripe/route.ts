import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendOrderEmails } from '@/lib/email';
import { sendPartyParticipationConfirmation } from '@/lib/parties/notify';
import { captureServerError } from '@/lib/observability/sentry';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { isOrderItemSnapshot, OrderItemSnapshot } from '@/lib/orders/items';
import {
  lockPartyForUpdate,
  nextPartyOrderNumber,
  updatePartyCapacityStatus,
} from '@/lib/parties/db';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

async function processPartyCheckoutEvent(
  event: Stripe.Event,
  request: NextRequest,
): Promise<NextResponse | null> {
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    if (!charge.refunded) return NextResponse.json({ received: true });
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (!paymentIntentId) return NextResponse.json({ received: true });
    const refundedParticipation = await db.partyParticipation.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true, partyId: true },
    });
    if (!refundedParticipation) return null;
    await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, refundedParticipation.partyId);
      const current = await tx.partyParticipation.findUnique({
        where: { id: refundedParticipation.id },
        select: { status: true },
      });
      if (!current || current.status === 'REFUNDED') return;
      const participation = await tx.partyParticipation.update({
        where: { id: refundedParticipation.id },
        data: {
          status: 'REFUNDED',
          refundStatus: 'APPROVED',
          slotNumber: null,
          reservationExpiresAt: null,
          refundedAt: new Date(),
        },
        select: { orderId: true },
      });
      if (participation.orderId) {
        await tx.order.updateMany({
          where: {
            id: participation.orderId,
            paymentStatus: 'PAID',
            status: 'PROCESSING',
          },
          data: { paymentStatus: 'CANCELLED', status: 'CANCELLED' },
        });
      }
      await tx.partyAuditLog.create({
        data: {
          partyId: refundedParticipation.partyId,
          action: 'REFUND_CONFIRMED',
          details: { participationId: refundedParticipation.id, paymentIntentId },
        },
      });
      await updatePartyCapacityStatus(tx, refundedParticipation.partyId);
    });
    return NextResponse.json({ received: true });
  }

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded' &&
    event.type !== 'checkout.session.async_payment_failed' &&
    event.type !== 'checkout.session.expired'
  ) {
    return null;
  }

  const eventSession = event.data.object as Stripe.Checkout.Session;
  const participation = await db.partyParticipation.findFirst({
    where: { stripeCheckoutSessionId: eventSession.id },
    select: { id: true, partyId: true },
  });
  if (!participation) return null;

  if (
    event.type === 'checkout.session.expired' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    await db.$transaction(async (tx) => {
      await lockPartyForUpdate(tx, participation.partyId);
      await tx.partyParticipation.updateMany({
        where: {
          id: participation.id,
          status: 'PENDING_PAYMENT',
        },
        data: { status: 'EXPIRED', slotNumber: null, reservationExpiresAt: null },
      });
      await updatePartyCapacityStatus(tx, participation.partyId);
    });
    return NextResponse.json({ received: true });
  }

  const checkout = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ['payment_intent'],
  });
  if (checkout.payment_status !== 'paid') {
    return NextResponse.json({ received: true, pending: true });
  }
  const paymentIntent =
    typeof checkout.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(checkout.payment_intent)
      : checkout.payment_intent;
  if (!paymentIntent) throw new Error(`Paid Party checkout has no PaymentIntent: ${checkout.id}`);

  const result = await db.$transaction(async (tx) => {
    await lockPartyForUpdate(tx, participation.partyId);
    const record = await tx.partyParticipation.findUnique({
      where: { id: participation.id },
      include: {
        party: { include: { product: true } },
        user: true,
        order: { select: { id: true, orderNumber: true } },
      },
    });
    if (!record) throw new Error(`Party participation disappeared: ${participation.id}`);
    if (record.status === 'PAID' && record.order) {
      return { kind: 'already-paid' as const, order: null };
    }
    if (record.status === 'REFUNDED') {
      return { kind: 'already-paid' as const, order: null };
    }
    if (record.status === 'REFUND_REQUIRED') {
      return { kind: 'recovery-required' as const, order: null };
    }

    const expectedCents = Math.round(Number(record.amountPaid) * 100);
    const actualCents = checkout.amount_total ?? -1;
    let slotNumber = record.slotNumber;

    if (
      record.status !== 'PENDING_PAYMENT' ||
      !record.reservationExpiresAt ||
      record.reservationExpiresAt <= new Date() ||
      record.party.status !== 'OPEN' ||
      actualCents !== expectedCents ||
      checkout.currency?.toLowerCase() !== 'eur'
    ) {
      slotNumber = null;
    }

    if (slotNumber === null && actualCents === expectedCents && record.party.status === 'OPEN') {
      await tx.partyParticipation.updateMany({
        where: {
          partyId: record.partyId,
          status: 'PENDING_PAYMENT',
          reservationExpiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED', slotNumber: null, reservationExpiresAt: null },
      });
      const occupied = await tx.partyParticipation.findMany({
        where: {
          partyId: record.partyId,
          id: { not: record.id },
          slotNumber: { not: null },
          status: { in: ['PENDING_PAYMENT', 'PAID', 'REFUND_REQUESTED', 'REFUND_REQUIRED'] },
        },
        select: { slotNumber: true },
      });
      const taken = new Set(occupied.map((entry) => entry.slotNumber));
      slotNumber = Array.from(
        { length: record.party.participantCount },
        (_, index) => index + 1,
      ).find((slot) => !taken.has(slot)) ?? null;
    }

    const paymentIntentId = paymentIntent.id;
    if (slotNumber === null || actualCents !== expectedCents || checkout.currency?.toLowerCase() !== 'eur') {
      await tx.partyParticipation.update({
        where: { id: record.id },
        data: {
          status: 'REFUND_REQUIRED',
          refundStatus: 'NONE',
          slotNumber: null,
          reservationExpiresAt: null,
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
        },
      });
      await tx.partyAuditLog.create({
        data: {
          partyId: record.partyId,
          action: 'PAYMENT_RECOVERY_REQUIRED',
          details: {
            participationId: record.id,
            paymentIntentId,
            actualCents,
            expectedCents,
            partyStatus: record.party.status,
          },
        },
      });
      return { kind: 'recovery-required' as const, order: null };
    }

    const order = await tx.order.create({
      data: {
        orderNumber: await nextPartyOrderNumber(tx),
        userId: record.userId,
        fullName: record.user.fullName || checkout.customer_details?.name || 'Cliente',
        email: record.user.email,
        phone: record.user.phone || checkout.customer_details?.phone || '',
        shippingAddress: record.user.addressLine || '',
        shippingPostalCode: record.user.postalCode || '',
        shippingCity: record.user.city || '',
        shippingLocality: record.user.locality || '',
        shippingProvince: record.user.province || '',
        totalAmount: String(expectedCents / 100),
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        paymentProvider: 'stripe',
        paymentAmount: String(expectedCents / 100),
        paymentCurrency: 'EUR',
        paymentPaidAt: new Date(),
        stripeSessionId: checkout.id,
        shippingMode: 'GROUPED',
        items: [
          {
            id: record.party.productId,
            productId: record.party.productId,
            name: `Participación Party — ${record.party.product.name}`,
            quantity: 1,
            price: expectedCents / 100,
            isPartyParticipation: true,
          },
        ] as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, orderNumber: true },
    });
    await tx.partyParticipation.update({
      where: { id: record.id },
      data: {
        status: 'PAID',
        refundStatus: 'NONE',
        slotNumber,
        reservationExpiresAt: null,
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        orderId: order.id,
      },
    });
    await tx.partyAuditLog.create({
      data: {
        partyId: record.partyId,
        action: 'PAYMENT_CONFIRMED',
        details: {
          participationId: record.id,
          orderId: order.id,
          paymentIntentId,
          slotNumber,
        },
      },
    });
    await updatePartyCapacityStatus(tx, record.partyId);
    return { kind: 'paid' as const, order };
  });

  if (result.kind === 'recovery-required') {
    return NextResponse.json({ received: true, requiresAdministrativeResolution: true });
  }
  if (result.kind === 'paid' && result.order) {
    try {
      await sendPartyParticipationConfirmation(result.order.id);
    } catch (emailError) {
      captureServerError({
        error: emailError,
        module: 'party_order_confirmation_email',
        request,
        orderId: result.order.id,
      });
    }
  }
  return NextResponse.json({ received: true });
}

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
  releaseDate?: string | null;
  isPreorder?: boolean;
}

function isPersistedCheckoutItem(value: unknown): value is PersistedCheckoutItem {
  return isOrderItemSnapshot(value);
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
    const partyResult = await processPartyCheckoutEvent(event, request);
    if (partyResult) return partyResult;

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
      const items = rawItems as OrderItemSnapshot[];

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

            // Live-opening cart ids carry a `_live` suffix but share the base product's stock.
            const productId = item.id.replace(/_live$/, '');
            const updateStock = await tx.product.updateMany({
              where: {
                id: productId,
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
          error instanceof Error &&
          error.message.startsWith('Insufficient stock for product ')
        ) {
          try {
            await stripe.refunds.create(
              { payment_intent: paymentIntent.id },
              { idempotencyKey: `checkout-stock-conflict-refund-${session.id}` },
            );
            await db.checkoutSessionCart.update({
              where: { sessionId: session.id },
              data: { processedAt: new Date(), inventoryConflictAt: new Date() },
            });
            return NextResponse.json({ received: true, refunded: true });
          } catch (refundError) {
            captureServerError({
              error: refundError,
              module: 'stripe_webhook_stock_conflict_refund',
              request,
              userEmail: customerEmail,
              extra: { stripeSessionId: session.id },
            });
            return NextResponse.json({ error: 'Stock conflict refund processing failed' }, { status: 500 });
          }
        }
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
        const preorderItems = items.filter(
          (item) => item.isPreorder && typeof item.releaseDate === 'string',
        );

        await Promise.all(
          preorderItems.map((item) =>
            captureServerEvent(customerEmail || session.id, 'preorder_purchased', {
              productId: item.id,
              productName: item.name,
              orderId: orderRecord?.id,
              releaseDate: item.releaseDate,
            }),
          ),
        );

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
              variant: it.id.endsWith('_live') ? 'live' : 'sealed',
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
