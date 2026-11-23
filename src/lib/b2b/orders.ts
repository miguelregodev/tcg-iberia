/**
 * B2B order service — single place for order creation, state transitions,
 * notes, shipping notifications, queries and (admin / customer) serializers.
 * API routes stay thin: authenticate → parse → call service → respond.
 *
 * Every state change:
 *   - is validated with the pure rules in `order-status.ts`;
 *   - is applied with an optimistic-concurrency guard (the update only
 *     matches if the three status columns still hold the values that were
 *     validated), so two concurrent admin actions cannot both win;
 *   - writes its audit event in the same transaction.
 * External side effects (emails, PDFs) run AFTER the commit and never roll
 * the state change back.
 *
 * Stock: B2B orders never reserve or decrement stock (they are reviewed
 * manually), so cancellations and returns intentionally do not restock.
 */

import type {
  B2bCustomer,
  B2bDocument,
  B2bFulfillmentStatus,
  B2bOrder,
  B2bOrderEvent,
  B2bOrderEventType,
  B2bOrderSource,
  B2bPaymentStatus,
  Prisma,
  ShippingProvider,
} from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { getTrackingUrl } from '@/lib/shipping/tracking-urls';
import type {
  B2bAdminDocumentView,
  B2bAdminOrderDetail,
  B2bAdminOrderListItem,
  B2bCustomerDocumentView,
  B2bCustomerOrderDetail,
  B2bCustomerOrderSummary,
  Paginated,
} from '@/types';
import { recordB2bOrderEvent, recordB2bOrderEventSafe } from './audit';
import { B2bServiceError } from './errors';
import { generateB2bOrderNumber } from './order-numbers';
import {
  canAccept,
  canCancel,
  canChangeFulfillment,
  canChangePayment,
  canReject,
  isRectified,
  paymentStatusAfterCancel,
  type B2bOrderState,
} from './order-status';
import { priceB2bOrder, type OrderLineInput, type PricingProduct, type PricingResult } from './pricing';
import { customerToSnapshot, readCustomerSnapshot, readOrderItems } from './snapshots';
import { sendB2bOrderShippedEmail } from './emails';
import { getB2bAppUrl } from './app-url';
import { B2B_EQUIVALENCE_SURCHARGE_RATE } from './company';
import {
  buildAdminOrderOrderBy,
  buildAdminOrderWhere,
  type AdminOrderFilters,
} from './admin-order-filters';

export const B2B_SHIPPING_PROVIDERS: readonly ShippingProvider[] = ['CORREOS', 'MRW', 'SEUR', 'CTT_EXPRESS'];
const TRACKING_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{2,99}$/;

// ── Pricing / creation ──────────────────────────────────────────────────────

export async function loadPricingProducts(ids: string[]): Promise<Map<string, PricingProduct>> {
  const rows = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true, language: true, imageUrl: true, b2bPrice: true, visible: true },
  });
  return new Map(
    rows.map((p) => [p.id, { ...p, b2bPrice: p.b2bPrice === null ? null : Number(p.b2bPrice) }])
  );
}

/** Recargo de Equivalencia rate that applies to a customer (0 when not under that regime). */
export function surchargeRateFor(customer: Pick<B2bCustomer, 'equivalenceSurcharge'> | null | undefined): number {
  return customer?.equivalenceSurcharge ? B2B_EQUIVALENCE_SURCHARGE_RATE : 0;
}

export async function priceB2bLines(
  lines: OrderLineInput[],
  shippingCostCents: number,
  surchargeRate = 0
): Promise<PricingResult> {
  const products = await loadPricingProducts(lines.map((l) => l.productId));
  return priceB2bOrder(lines, products, { shippingCostCents, surchargeRate });
}

export interface CreateB2bOrderInput {
  customer: B2bCustomer;
  lines: OrderLineInput[];
  shippingCostCents: number;
  notes: string | null;
  internalNotes: string | null;
  source: B2bOrderSource;
  actor: string;
  idempotencyKey: string | null;
  initialStatus: 'PENDING' | 'ACCEPTED';
  /** Admin flow: reject the whole order if any product cannot be priced. */
  rejectOnUnpricedLines: boolean;
}

export interface CreateB2bOrderResult {
  order: B2bOrder;
  pricing: PricingResult;
  duplicate: boolean;
}

async function findByIdempotencyKey(key: string, customerId: string): Promise<B2bOrder | null> {
  const existing = await db.b2bOrder.findUnique({ where: { idempotencyKey: key } });
  if (existing && existing.customerId !== customerId) {
    throw new B2bServiceError('Clave de idempotencia ya utilizada para otro cliente.', 409);
  }
  return existing;
}

function pricingFromOrder(order: B2bOrder): PricingResult {
  return {
    items: readOrderItems(order.items),
    rejections: [],
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    shippingCost: Number(order.shippingCost),
    vatRate: Number(order.vatRate),
    ivaAmount: Number(order.ivaAmount),
    surchargeRate: Number(order.surchargeRate),
    surchargeAmount: Number(order.surchargeAmount),
    total: Number(order.total),
  };
}

export async function createB2bOrder(input: CreateB2bOrderInput): Promise<CreateB2bOrderResult> {
  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(input.idempotencyKey, input.customer.id);
    if (existing) return { order: existing, pricing: pricingFromOrder(existing), duplicate: true };
  }

  const pricing = await priceB2bLines(input.lines, input.shippingCostCents, surchargeRateFor(input.customer));
  if (input.rejectOnUnpricedLines && pricing.rejections.length > 0) {
    throw new B2bServiceError(
      `Hay ${pricing.rejections.length} producto(s) no disponibles o sin precio B2B. Revisa el pedido.`,
      422
    );
  }
  if (pricing.items.length === 0) {
    throw new B2bServiceError('Ningún producto del pedido está disponible.', 409);
  }

  const isAdmin = input.source === 'ADMIN';
  const now = new Date();
  try {
    const order = await db.$transaction(async (tx) => {
      const orderNumber = await generateB2bOrderNumber(tx);
      const created = await tx.b2bOrder.create({
        data: {
          customerId: input.customer.id,
          orderNumber,
          source: input.source,
          status: input.initialStatus,
          acceptedAt: input.initialStatus === 'ACCEPTED' ? now : null,
          items: pricing.items as unknown as Prisma.InputJsonValue,
          customerSnapshot: customerToSnapshot(input.customer) as unknown as Prisma.InputJsonValue,
          vatRate: pricing.vatRate,
          subtotal: pricing.subtotal,
          discountTotal: pricing.discountTotal,
          shippingCost: pricing.shippingCost,
          ivaAmount: pricing.ivaAmount,
          surchargeRate: pricing.surchargeRate,
          surchargeAmount: pricing.surchargeAmount,
          total: pricing.total,
          notes: input.notes,
          internalNotes: input.internalNotes,
          createdBy: input.actor,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await recordB2bOrderEvent(tx, created.id, isAdmin ? 'ORDER_CREATED_BY_ADMIN' : 'ORDER_CREATED', input.actor, {
        orderNumber,
        lines: pricing.items.length,
        total: pricing.total,
        initialStatus: input.initialStatus,
        ...(pricing.rejections.length > 0 && { rejectedLines: pricing.rejections.length }),
      });
      if (input.internalNotes) {
        await recordB2bOrderEvent(tx, created.id, 'ADMIN_NOTE_UPDATED', input.actor, {
          note: input.internalNotes.slice(0, 500),
        });
      }
      return created;
    });
    return { order, pricing, duplicate: false };
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002' && input.idempotencyKey) {
      const existing = await findByIdempotencyKey(input.idempotencyKey, input.customer.id);
      if (existing) return { order: existing, pricing: pricingFromOrder(existing), duplicate: true };
    }
    throw err;
  }
}

// ── Transitions ─────────────────────────────────────────────────────────────

type OrderWithCustomer = B2bOrder & { customer: B2bCustomer };

async function loadOrder(orderId: string, customerId?: string): Promise<OrderWithCustomer> {
  const order = await db.b2bOrder.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order || (customerId !== undefined && order.customerId !== customerId)) {
    throw new B2bServiceError('Pedido no encontrado.', 404);
  }
  return order;
}

function assertRule(result: { ok: true } | { ok: false; error: string }): void {
  if (!result.ok) throw new B2bServiceError(result.error, 409);
}

interface PendingEvent {
  type: B2bOrderEventType;
  metadata?: Record<string, unknown>;
}

async function applyGuardedUpdate(
  order: B2bOrderState & { id: string },
  data: Prisma.B2bOrderUpdateManyMutationInput,
  actor: string,
  events: PendingEvent[]
): Promise<OrderWithCustomer> {
  return db.$transaction(async (tx) => {
    const res = await tx.b2bOrder.updateMany({
      where: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
      },
      data,
    });
    if (res.count !== 1) {
      throw new B2bServiceError(
        'El pedido ha cambiado mientras se procesaba la acción. Recarga e inténtalo de nuevo.',
        409
      );
    }
    for (const e of events) await recordB2bOrderEvent(tx, order.id, e.type, actor, e.metadata);
    return tx.b2bOrder.findUniqueOrThrow({ where: { id: order.id }, include: { customer: true } });
  });
}

export async function acceptB2bOrder(orderId: string, actor: string): Promise<OrderWithCustomer> {
  const order = await loadOrder(orderId);
  assertRule(canAccept(order));
  return applyGuardedUpdate(order, { status: 'ACCEPTED', acceptedAt: new Date() }, actor, [
    { type: 'ORDER_ACCEPTED' },
  ]);
}

export async function rejectB2bOrder(
  orderId: string,
  actor: string,
  reason: string | null
): Promise<OrderWithCustomer> {
  const order = await loadOrder(orderId);
  assertRule(canReject(order));
  return applyGuardedUpdate(
    order,
    {
      status: 'REJECTED',
      rejectedAt: new Date(),
      cancellationReason: reason,
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: paymentStatusAfterCancel(order.paymentStatus),
    },
    actor,
    [{ type: 'ORDER_REJECTED', metadata: { reason } }]
  );
}

export async function cancelB2bOrder(input: {
  orderId: string;
  actor: string;
  by: 'admin' | 'customer';
  reason: string | null;
  customerId?: string;
}): Promise<{ order: OrderWithCustomer; requiresRefund: boolean; requiresCorrectiveInvoice: boolean }> {
  const order = await loadOrder(input.orderId, input.customerId);
  assertRule(canCancel(order, input.by));

  const docs = await db.b2bDocument.findMany({
    where: { orderId: order.id },
    select: { id: true, type: true, status: true, correctsDocumentId: true },
  });
  const requiresCorrectiveInvoice = docs.some(
    (d) => d.type === 'INVOICE' && d.status === 'ISSUED' && !isRectified(d, docs)
  );
  const nextPayment = paymentStatusAfterCancel(order.paymentStatus);
  const requiresRefund = nextPayment === 'PAID';

  const updated = await applyGuardedUpdate(
    order,
    {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: input.actor,
      cancellationReason: input.reason,
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: nextPayment,
    },
    input.actor,
    [
      {
        type: 'ORDER_CANCELLED',
        metadata: {
          by: input.by,
          reason: input.reason,
          previousStatus: order.status,
          previousFulfillmentStatus: order.fulfillmentStatus,
          paymentStatus: { from: order.paymentStatus, to: nextPayment },
          requiresRefund,
          requiresCorrectiveInvoice,
        },
      },
    ]
  );
  return { order: updated, requiresRefund, requiresCorrectiveInvoice };
}

export async function updateB2bPaymentStatus(input: {
  orderId: string;
  actor: string;
  status: B2bPaymentStatus;
  method: string | null;
  reference: string | null;
  paidAt: Date | null;
}): Promise<OrderWithCustomer> {
  const order = await loadOrder(input.orderId);
  assertRule(canChangePayment(order, input.status));

  const now = new Date();
  const data: Prisma.B2bOrderUpdateManyMutationInput = { paymentStatus: input.status };
  if (input.status === 'PAID') {
    if (input.paidAt && input.paidAt.getTime() > now.getTime() + 60_000) {
      throw new B2bServiceError('La fecha de pago no puede estar en el futuro.', 422);
    }
    data.paidAt = input.paidAt ?? now;
    data.paymentMethod = input.method ?? 'Transferencia bancaria';
    data.paymentReference = input.reference;
  } else if (input.status === 'REFUNDED') {
    data.refundedAt = now;
  } else if (input.status === 'PENDING' && order.paymentStatus === 'PAID') {
    data.paidAt = null;
    data.paymentMethod = null;
    data.paymentReference = null;
  }

  return applyGuardedUpdate(order, data, input.actor, [
    {
      type: 'PAYMENT_STATUS_CHANGED',
      metadata: {
        from: order.paymentStatus,
        to: input.status,
        ...(input.status === 'PAID' && {
          method: data.paymentMethod,
          reference: input.reference,
          paidAt: (data.paidAt as Date).toISOString(),
        }),
      },
    },
  ]);
}

export async function updateB2bFulfillment(input: {
  orderId: string;
  actor: string;
  status: B2bFulfillmentStatus;
  trackingNumber: string | null;
  shippingProvider: string | null;
  reason: string | null;
}): Promise<{ order: OrderWithCustomer; shouldNotify: boolean }> {
  const order = await loadOrder(input.orderId);
  assertRule(canChangeFulfillment(order, input.status));
  const now = new Date();

  if (input.status === 'SHIPPED') {
    const provider = input.shippingProvider as ShippingProvider | null;
    if (!provider || !B2B_SHIPPING_PROVIDERS.includes(provider)) {
      throw new B2bServiceError('Selecciona un proveedor logístico válido.', 422);
    }
    const tracking = input.trackingNumber?.trim() ?? '';
    if (!TRACKING_NUMBER_RE.test(tracking)) {
      throw new B2bServiceError(
        'Introduce un número de seguimiento válido (3-100 caracteres alfanuméricos).',
        422
      );
    }

    if (order.fulfillmentStatus === 'SHIPPED') {
      const events: PendingEvent[] = [];
      if (tracking !== order.trackingNumber) {
        events.push({ type: 'TRACKING_UPDATED', metadata: { from: order.trackingNumber, to: tracking } });
      }
      if (provider !== order.shippingProvider) {
        events.push({ type: 'CARRIER_CHANGED', metadata: { from: order.shippingProvider, to: provider } });
      }
      if (events.length === 0) throw new B2bServiceError('No hay cambios en los datos de envío.', 409);
      const updated = await applyGuardedUpdate(
        order,
        { trackingNumber: tracking, shippingProvider: provider },
        input.actor,
        events
      );
      return { order: updated, shouldNotify: false };
    }

    const updated = await applyGuardedUpdate(
      order,
      {
        fulfillmentStatus: 'SHIPPED',
        trackingNumber: tracking,
        shippingProvider: provider,
        shippedAt: now,
        shippingEmailSentAt: null,
        shippingEmailError: null,
      },
      input.actor,
      [
        {
          type: 'ORDER_SHIPPED',
          metadata: { from: order.fulfillmentStatus, shippingProvider: provider, trackingNumber: tracking },
        },
      ]
    );
    return { order: updated, shouldNotify: true };
  }

  const data: Prisma.B2bOrderUpdateManyMutationInput = { fulfillmentStatus: input.status };
  let event: PendingEvent = {
    type: 'FULFILLMENT_STATUS_CHANGED',
    metadata: { from: order.fulfillmentStatus, to: input.status },
  };
  if (input.status === 'PROCESSING') data.processingAt = now;
  if (input.status === 'PENDING') data.processingAt = null;
  if (input.status === 'DELIVERED') {
    data.deliveredAt = now;
    event = { type: 'ORDER_DELIVERED', metadata: { from: order.fulfillmentStatus } };
  }
  if (input.status === 'RETURNED') {
    data.returnedAt = now;
    data.returnReason = input.reason;
    event = {
      type: 'ORDER_RETURNED',
      metadata: { from: order.fulfillmentStatus, reason: input.reason, paymentStatus: order.paymentStatus },
    };
  }
  const updated = await applyGuardedUpdate(order, data, input.actor, [event]);
  return { order: updated, shouldNotify: false };
}

export async function updateB2bOrderNotes(input: {
  orderId: string;
  actor: string;
  internalNotes?: string | null;
  notes?: string | null;
}): Promise<OrderWithCustomer> {
  const order = await loadOrder(input.orderId);
  const data: Prisma.B2bOrderUpdateInput = {};
  const events: PendingEvent[] = [];
  if (input.internalNotes !== undefined && input.internalNotes !== order.internalNotes) {
    data.internalNotes = input.internalNotes;
    events.push({ type: 'ADMIN_NOTE_UPDATED', metadata: { note: input.internalNotes?.slice(0, 500) ?? null } });
  }
  if (input.notes !== undefined && input.notes !== order.notes) {
    data.notes = input.notes;
    events.push({ type: 'CUSTOMER_NOTE_UPDATED', metadata: { note: input.notes?.slice(0, 500) ?? null } });
  }
  if (events.length === 0) throw new B2bServiceError('No hay cambios que guardar.', 409);

  return db.$transaction(async (tx) => {
    const row = await tx.b2bOrder.update({ where: { id: order.id }, data, include: { customer: true } });
    for (const e of events) await recordB2bOrderEvent(tx, order.id, e.type, input.actor, e.metadata);
    return row;
  });
}

/**
 * Sends the "order shipped" email. Never throws for delivery failures: the
 * outcome is persisted on the order + audit trail so admins can retry.
 */
export async function sendB2bShippingNotification(input: {
  orderId: string;
  actor: string;
  orderUrl: string;
  isRetry: boolean;
}): Promise<{ sent: boolean; error: string | null }> {
  const order = await loadOrder(input.orderId);
  if (
    (order.fulfillmentStatus !== 'SHIPPED' && order.fulfillmentStatus !== 'DELIVERED') ||
    !order.trackingNumber ||
    !order.shippingProvider
  ) {
    throw new B2bServiceError('El pedido no tiene datos de envío que notificar.', 409);
  }
  if (input.isRetry) {
    await recordB2bOrderEventSafe(order.id, 'SHIPPING_EMAIL_RETRIED', input.actor, {
      previousError: order.shippingEmailError,
    });
  }

  try {
    await sendB2bOrderShippedEmail({
      to: order.customer.email,
      contactName: order.customer.contactName,
      companyName: order.customer.companyName,
      orderNumber: order.orderNumber,
      shippingProvider: order.shippingProvider,
      trackingNumber: order.trackingNumber,
      orderUrl: input.orderUrl,
    });
    await db.b2bOrder.update({
      where: { id: order.id },
      data: { shippingEmailSentAt: new Date(), shippingEmailError: null },
    });
    await recordB2bOrderEventSafe(order.id, 'SHIPPING_EMAIL_SENT', input.actor, {
      to: order.customer.email,
      shippingProvider: order.shippingProvider,
      trackingNumber: order.trackingNumber,
    });
    return { sent: true, error: null };
  } catch (err) {
    const error = `No se pudo enviar el email de envío (${err instanceof Error ? err.name : 'Error'}).`;
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'shipping_email' },
      extra: { orderId: order.id },
    });
    await db.b2bOrder
      .update({ where: { id: order.id }, data: { shippingEmailError: error } })
      .catch(() => undefined);
    await recordB2bOrderEventSafe(order.id, 'SHIPPING_EMAIL_FAILED', input.actor, { error });
    return { sent: false, error };
  }
}

// ── Serializers ─────────────────────────────────────────────────────────────

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

type DocLite = Pick<
  B2bDocument,
  'id' | 'type' | 'status' | 'number' | 'issuedAt' | 'total' | 'correctsDocumentId'
>;

function customerDocView(doc: DocLite, all: readonly DocLite[]): B2bCustomerDocumentView {
  return {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    issuedAt: doc.issuedAt.toISOString(),
    total: Number(doc.total),
    correctsNumber: all.find((d) => d.id === doc.correctsDocumentId)?.number ?? null,
  };
}

function adminDocView(doc: B2bDocument, all: readonly B2bDocument[]): B2bAdminDocumentView {
  return {
    ...customerDocView(doc, all),
    status: doc.status,
    attempts: doc.attempts,
    lastError: doc.lastError,
    lastAttemptAt: iso(doc.lastAttemptAt),
    generatedAt: iso(doc.generatedAt),
    fileName: doc.fileName,
    correctsDocumentId: doc.correctsDocumentId,
    correctionReason: doc.correctionReason,
    correctedByNumbers: all.filter((d) => d.correctsDocumentId === doc.id).map((d) => d.number),
    createdBy: doc.createdBy,
  };
}

function trackingUrlFor(order: Pick<B2bOrder, 'shippingProvider' | 'trackingNumber'>): string | null {
  return order.shippingProvider && order.trackingNumber
    ? getTrackingUrl(order.shippingProvider, order.trackingNumber)
    : null;
}

export function toAdminOrderDetail(
  order: OrderWithCustomer & { documents: B2bDocument[]; events: B2bOrderEvent[] }
): B2bAdminOrderDetail {
  const docs = [...order.documents].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    items: readOrderItems(order.items),
    customer: {
      ...readCustomerSnapshot(order.customerSnapshot),
      id: order.customer.id,
      currentStatus: order.customer.status,
    },
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    shippingCost: Number(order.shippingCost),
    vatRate: Number(order.vatRate),
    ivaAmount: Number(order.ivaAmount),
    surchargeRate: Number(order.surchargeRate),
    surchargeAmount: Number(order.surchargeAmount),
    total: Number(order.total),
    notes: order.notes,
    internalNotes: order.internalNotes,
    createdBy: order.createdBy,
    createdAt: order.createdAt.toISOString(),
    acceptedAt: iso(order.acceptedAt),
    rejectedAt: iso(order.rejectedAt),
    cancelledAt: iso(order.cancelledAt),
    cancelledBy: order.cancelledBy,
    cancellationReason: order.cancellationReason,
    paidAt: iso(order.paidAt),
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    refundedAt: iso(order.refundedAt),
    shippingProvider: order.shippingProvider,
    trackingNumber: order.trackingNumber,
    trackingUrl: trackingUrlFor(order),
    processingAt: iso(order.processingAt),
    shippedAt: iso(order.shippedAt),
    deliveredAt: iso(order.deliveredAt),
    returnedAt: iso(order.returnedAt),
    returnReason: order.returnReason,
    shippingEmailSentAt: iso(order.shippingEmailSentAt),
    shippingEmailError: order.shippingEmailError,
    documents: docs.map((d) => adminDocView(d, docs)),
    events: [...order.events]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((e) => ({
        id: e.id,
        type: e.type,
        actor: e.actor,
        metadata: (e.metadata as Record<string, unknown> | null) ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
  };
}

const ADMIN_LIST_INCLUDE = {
  customer: { select: { id: true, companyName: true, email: true, vatNumber: true } },
  documents: {
    where: { type: 'INVOICE' as const },
    orderBy: { createdAt: 'desc' as const },
    select: { number: true, status: true, uniquenessKey: true },
  },
} satisfies Prisma.B2bOrderInclude;

type AdminListRow = Prisma.B2bOrderGetPayload<{ include: typeof ADMIN_LIST_INCLUDE }>;

function toAdminListItem(o: AdminListRow): B2bAdminOrderListItem {
  const invoice = o.documents.find((d) => d.uniquenessKey !== null) ?? o.documents[0] ?? null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    source: o.source,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    total: Number(o.total),
    createdAt: o.createdAt.toISOString(),
    trackingNumber: o.trackingNumber,
    shippingProvider: o.shippingProvider,
    invoiceNumber: invoice?.number ?? null,
    invoiceStatus: invoice?.status ?? null,
    customer: o.customer,
  };
}

function toCustomerSummary(order: B2bOrder, docs: readonly DocLite[]): B2bCustomerOrderSummary {
  const items = readOrderItems(order.items);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    total: Number(order.total),
    itemCount: items.length,
    unitCount: items.reduce((s, i) => s + i.quantity, 0),
    trackingNumber: order.trackingNumber,
    shippingProvider: order.shippingProvider,
    trackingUrl: trackingUrlFor(order),
    hasInvoice: docs.some((d) => d.type === 'INVOICE' && d.status === 'ISSUED'),
    createdAt: order.createdAt.toISOString(),
    canCancel: canCancel(order, 'customer').ok,
  };
}

/** Customer projection — excludes internal notes, audit events, actors and storage data. */
export function toCustomerOrderDetail(order: B2bOrder, docs: readonly DocLite[]): B2bCustomerOrderDetail {
  const issued = docs.filter((d) => d.status === 'ISSUED');
  return {
    ...toCustomerSummary(order, docs),
    items: readOrderItems(order.items),
    customer: readCustomerSnapshot(order.customerSnapshot),
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    shippingCost: Number(order.shippingCost),
    vatRate: Number(order.vatRate),
    ivaAmount: Number(order.ivaAmount),
    surchargeRate: Number(order.surchargeRate),
    surchargeAmount: Number(order.surchargeAmount),
    notes: order.notes,
    acceptedAt: iso(order.acceptedAt),
    paidAt: iso(order.paidAt),
    refundedAt: iso(order.refundedAt),
    shippedAt: iso(order.shippedAt),
    deliveredAt: iso(order.deliveredAt),
    returnedAt: iso(order.returnedAt),
    cancelledAt: iso(order.cancelledAt ?? order.rejectedAt),
    cancellationReason: order.cancellationReason,
    documents: issued
      .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime())
      .map((d) => customerDocView(d, docs)),
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

const DOC_LITE_SELECT = {
  id: true,
  type: true,
  status: true,
  number: true,
  issuedAt: true,
  total: true,
  correctsDocumentId: true,
} satisfies Prisma.B2bDocumentSelect;

export async function listAdminB2bOrders(f: AdminOrderFilters): Promise<Paginated<B2bAdminOrderListItem>> {
  const where = buildAdminOrderWhere(f);
  const [total, rows] = await db.$transaction([
    db.b2bOrder.count({ where }),
    db.b2bOrder.findMany({
      where,
      orderBy: buildAdminOrderOrderBy(f),
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: ADMIN_LIST_INCLUDE,
    }),
  ]);
  return {
    items: rows.map(toAdminListItem),
    total,
    page: f.page,
    pageSize: f.pageSize,
    totalPages: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

export async function getAdminB2bOrderDetail(orderId: string): Promise<B2bAdminOrderDetail> {
  const order = await db.b2bOrder.findUnique({
    where: { id: orderId },
    include: { customer: true, documents: true, events: true },
  });
  if (!order) throw new B2bServiceError('Pedido no encontrado.', 404);
  return toAdminOrderDetail(order);
}

export async function listCustomerB2bOrders(
  customerId: string,
  page: number,
  pageSize: number
): Promise<Paginated<B2bCustomerOrderSummary>> {
  const where = { customerId };
  const [total, rows] = await db.$transaction([
    db.b2bOrder.count({ where }),
    db.b2bOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { documents: { select: DOC_LITE_SELECT } },
    }),
  ]);
  return {
    items: rows.map((o) => toCustomerSummary(o, o.documents)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Ownership enforced in the query itself: another customer's order is indistinguishable from a missing one. */
export async function getCustomerB2bOrder(customerId: string, orderId: string): Promise<B2bCustomerOrderDetail> {
  const order = await db.b2bOrder.findFirst({
    where: { id: orderId, customerId },
    include: { documents: { select: DOC_LITE_SELECT } },
  });
  if (!order) throw new B2bServiceError('Pedido no encontrado.', 404);
  return toCustomerOrderDetail(order, order.documents);
}

export function b2bOrderUrl(appUrl: string, orderId: string): string {
  return `${appUrl}/mi-cuenta/b2b/pedidos?pedido=${encodeURIComponent(orderId)}`;
}

/** Customer-facing order URL for emails; falls back to the request origin if the public URL is misconfigured. */
export function resolveB2bOrderUrl(requestOrigin: string, orderId: string): string {
  let appUrl = requestOrigin;
  try {
    appUrl = getB2bAppUrl(requestOrigin);
  } catch {
    // keep request origin
  }
  return b2bOrderUrl(appUrl, orderId);
}
