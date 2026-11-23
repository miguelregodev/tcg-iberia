/**
 * B2B order state rules — pure and client-safe (no server imports) so the
 * API enforces them and the admin / customer UIs only offer valid actions.
 *
 * Four INDEPENDENT dimensions:
 *   lifecycle   (status)            PENDING → ACCEPTED | REJECTED | CANCELLED
 *   payment     (paymentStatus)     PENDING ⇄ PAID → REFUNDED ; PENDING ⇄ CANCELLED
 *   fulfillment (fulfillmentStatus) PENDING ⇄ PROCESSING → SHIPPED → DELIVERED → RETURNED
 *   documents   (B2bDocument rows)  see getDocumentEligibility()
 *
 * Cross-dimension rules are deliberately minimal:
 *   - payment can be collected and goods prepared/shipped only for ACCEPTED orders;
 *   - cancelling stops fulfillment (→ CANCELLED) and voids a PENDING payment, but
 *     a PAID payment stays PAID until an explicit refund is recorded;
 *   - returns never touch the payment; refunds never touch fulfillment.
 */

import type {
  B2bDocumentStatusValue,
  B2bDocumentTypeValue,
  B2bFulfillmentStatusValue,
  B2bOrderLifecycleStatus,
  B2bPaymentStatusValue,
} from '@/types';

export interface B2bOrderState {
  status: B2bOrderLifecycleStatus;
  paymentStatus: B2bPaymentStatusValue;
  fulfillmentStatus: B2bFulfillmentStatusValue;
}

export type RuleResult = { ok: true } | { ok: false; error: string };

const ok: RuleResult = { ok: true };
const fail = (error: string): RuleResult => ({ ok: false, error });

// ── Labels ──────────────────────────────────────────────────────────────────

export const B2B_ORDER_STATUS_LABEL: Record<B2bOrderLifecycleStatus, string> = {
  PENDING: 'Pendiente de confirmar',
  ACCEPTED: 'Confirmado',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rechazado',
};

export const B2B_PAYMENT_STATUS_LABEL: Record<B2bPaymentStatusValue, string> = {
  PENDING: 'Pago pendiente',
  PAID: 'Pagado',
  REFUNDED: 'Reembolsado',
  CANCELLED: 'Pago anulado',
};

export const B2B_FULFILLMENT_STATUS_LABEL: Record<B2bFulfillmentStatusValue, string> = {
  PENDING: 'Sin preparar',
  PROCESSING: 'En preparación',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  RETURNED: 'Devuelto',
  CANCELLED: 'Envío cancelado',
};

export const B2B_DOCUMENT_TYPE_LABEL: Record<B2bDocumentTypeValue, string> = {
  INVOICE: 'Factura',
  PROFORMA: 'Factura proforma',
  QUOTATION: 'Presupuesto',
  CORRECTIVE_INVOICE: 'Factura rectificativa',
};

export const B2B_DOCUMENT_STATUS_LABEL: Record<B2bDocumentStatusValue, string> = {
  GENERATING: 'Generando',
  ISSUED: 'Emitido',
  FAILED: 'Error de generación',
};

/** Documents with legal/fiscal value. Proformas and quotations are preliminary. */
export const FISCAL_DOCUMENT_TYPES: readonly B2bDocumentTypeValue[] = ['INVOICE', 'CORRECTIVE_INVOICE'];

// ── Lifecycle ───────────────────────────────────────────────────────────────

export function canAccept(order: B2bOrderState): RuleResult {
  return order.status === 'PENDING' ? ok : fail('Solo los pedidos pendientes pueden confirmarse.');
}

export function canReject(order: B2bOrderState): RuleResult {
  return order.status === 'PENDING' ? ok : fail('Solo los pedidos pendientes pueden rechazarse.');
}

export function canCancel(order: B2bOrderState, by: 'admin' | 'customer'): RuleResult {
  if (order.status !== 'PENDING' && order.status !== 'ACCEPTED') {
    return fail('Este pedido ya no puede cancelarse.');
  }
  if (order.fulfillmentStatus !== 'PENDING' && order.fulfillmentStatus !== 'PROCESSING') {
    return fail('El pedido ya ha sido enviado: regístralo como devolución en lugar de cancelarlo.');
  }
  if (by === 'customer') {
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') {
      return fail('No es posible cancelar un pedido ya pagado. Contacta con nosotros.');
    }
    if (order.fulfillmentStatus !== 'PENDING') {
      return fail('El pedido ya está en preparación. Contacta con nosotros para cancelarlo.');
    }
  }
  return ok;
}

/** Payment status that results from cancelling an order (paid money is never auto-refunded). */
export function paymentStatusAfterCancel(current: B2bPaymentStatusValue): B2bPaymentStatusValue {
  return current === 'PENDING' ? 'CANCELLED' : current;
}

// ── Payment ─────────────────────────────────────────────────────────────────

const PAYMENT_TRANSITIONS: Record<B2bPaymentStatusValue, readonly B2bPaymentStatusValue[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PENDING', 'REFUNDED'],
  REFUNDED: [],
  CANCELLED: ['PENDING'],
};

export function canChangePayment(order: B2bOrderState, to: B2bPaymentStatusValue): RuleResult {
  if (order.paymentStatus === to) return fail('El pago ya tiene ese estado.');
  if (!PAYMENT_TRANSITIONS[order.paymentStatus].includes(to)) {
    return fail(
      `No se puede pasar de "${B2B_PAYMENT_STATUS_LABEL[order.paymentStatus]}" a "${B2B_PAYMENT_STATUS_LABEL[to]}".`
    );
  }
  if (to === 'PAID' && order.status !== 'ACCEPTED') {
    return fail('Solo los pedidos confirmados pueden marcarse como pagados.');
  }
  if (to === 'PENDING' && order.status !== 'ACCEPTED' && order.status !== 'PENDING') {
    return fail('No se puede reabrir el pago de un pedido cancelado o rechazado.');
  }
  return ok;
}

export function allowedPaymentTargets(order: B2bOrderState): B2bPaymentStatusValue[] {
  return PAYMENT_TRANSITIONS[order.paymentStatus].filter((to) => canChangePayment(order, to).ok);
}

// ── Fulfillment ─────────────────────────────────────────────────────────────

const FULFILLMENT_TRANSITIONS: Record<B2bFulfillmentStatusValue, readonly B2bFulfillmentStatusValue[]> = {
  PENDING: ['PROCESSING', 'SHIPPED'],
  PROCESSING: ['PENDING', 'SHIPPED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
};

export function canChangeFulfillment(
  order: B2bOrderState,
  to: B2bFulfillmentStatusValue
): RuleResult {
  if (to === 'CANCELLED') return fail('Usa la acción "Cancelar pedido" para cancelar el envío.');
  if (order.fulfillmentStatus === to) {
    return to === 'SHIPPED' ? ok : fail('El envío ya tiene ese estado.');
  }
  if (!FULFILLMENT_TRANSITIONS[order.fulfillmentStatus].includes(to)) {
    return fail(
      `No se puede pasar de "${B2B_FULFILLMENT_STATUS_LABEL[order.fulfillmentStatus]}" a "${B2B_FULFILLMENT_STATUS_LABEL[to]}".`
    );
  }
  if ((to === 'PROCESSING' || to === 'SHIPPED') && order.status !== 'ACCEPTED') {
    return fail('Solo los pedidos confirmados pueden prepararse o enviarse.');
  }
  return ok;
}

export function allowedFulfillmentTargets(order: B2bOrderState): B2bFulfillmentStatusValue[] {
  return FULFILLMENT_TRANSITIONS[order.fulfillmentStatus].filter(
    (to) => canChangeFulfillment(order, to).ok
  );
}

// ── Documents ───────────────────────────────────────────────────────────────

export interface DocumentState {
  id: string;
  type: B2bDocumentTypeValue;
  status: B2bDocumentStatusValue;
  correctsDocumentId: string | null;
}

/** An invoice is "active" until a corrective invoice has been created for it. */
export function isRectified(doc: DocumentState, all: readonly DocumentState[]): boolean {
  return all.some((d) => d.type === 'CORRECTIVE_INVOICE' && d.correctsDocumentId === doc.id);
}

export function getDocumentEligibility(
  order: B2bOrderState,
  documents: readonly DocumentState[],
  type: B2bDocumentTypeValue,
  correctsDocumentId?: string | null
): RuleResult {
  const activeOf = (t: B2bDocumentTypeValue) =>
    documents.filter((d) => d.type === t && !(t === 'INVOICE' && isRectified(d, documents)));
  const activeInvoice = activeOf('INVOICE')[0];

  const pendingRetry = (doc: DocumentState | undefined) =>
    doc && doc.status !== 'ISSUED'
      ? fail(`Ya existe un documento de este tipo con estado "${B2B_DOCUMENT_STATUS_LABEL[doc.status]}": reinténtalo en lugar de crear otro.`)
      : null;

  switch (type) {
    case 'INVOICE': {
      if (order.status !== 'ACCEPTED') return fail('Solo se pueden facturar pedidos confirmados.');
      if (activeInvoice) {
        return (
          pendingRetry(activeInvoice) ??
          fail('Este pedido ya tiene una factura emitida. Para corregirla emite una factura rectificativa.')
        );
      }
      return ok;
    }
    case 'PROFORMA':
    case 'QUOTATION': {
      if (order.status !== 'PENDING' && order.status !== 'ACCEPTED') {
        return fail('El pedido está cancelado o rechazado.');
      }
      if (activeInvoice) return fail('El pedido ya está facturado.');
      const existing = activeOf(type)[0];
      if (existing) {
        return pendingRetry(existing) ?? fail(`Este pedido ya tiene ${B2B_DOCUMENT_TYPE_LABEL[type].toLowerCase()}.`);
      }
      return ok;
    }
    case 'CORRECTIVE_INVOICE': {
      const target = documents.find((d) => d.id === correctsDocumentId);
      if (!target || target.type !== 'INVOICE') {
        return fail('Selecciona la factura que quieres rectificar.');
      }
      if (target.status !== 'ISSUED') return fail('Solo se pueden rectificar facturas emitidas.');
      if (isRectified(target, documents)) return fail('Esta factura ya ha sido rectificada.');
      return ok;
    }
    default:
      return fail('Tipo de documento no soportado.');
  }
}
