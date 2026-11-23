'use client';

/**
 * Admin B2B order detail: full order data plus every management action.
 * Only actions that are valid for the current state are offered — the same
 * pure rules (`src/lib/b2b/order-status.ts`) are enforced again server-side.
 *
 * Final (fiscal) invoice actions are visually distinct (red, "Fiscal") from
 * preliminary documents (proforma / quotation).
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  B2bAdminDocumentView,
  B2bAdminOrderDetail,
  B2bDocumentTypeValue,
  B2bFulfillmentStatusValue,
  B2bPaymentStatusValue,
} from '@/types';
import {
  B2B_DOCUMENT_TYPE_LABEL,
  FISCAL_DOCUMENT_TYPES,
  allowedFulfillmentTargets,
  allowedPaymentTargets,
  canCancel,
  canChangeFulfillment,
  getDocumentEligibility,
  isRectified,
  type B2bOrderState,
} from '@/lib/b2b/order-status';
import { getProviderLabel, type ShippingProvider } from '@/lib/shipping/tracking-urls';
import {
  Badge,
  DocumentStatusBadge,
  FulfillmentBadge,
  LifecycleBadge,
  Modal,
  PaymentBadge,
  Section,
  btnDanger,
  btnFiscal,
  btnPrimary,
  btnSecondary,
  carrierLabel,
  describeEvent,
  eurFmt,
  formatDate,
  formatDateTime,
  inputClass,
} from './B2bOrderUi';
import { B2bOrderLinesTable } from './B2bOrderLinesTable';

type Notify = (type: 'success' | 'error', message: string) => void;

interface AdminB2bOrderDetailModalProps {
  orderId: string;
  notify: Notify;
  onClose: () => void;
  onChanged: () => void;
}

const CARRIERS: ShippingProvider[] = ['CORREOS', 'MRW', 'SEUR', 'CTT_EXPRESS'];
const GENERATION_LOCK_MS = 3 * 60 * 1000;

const PAYMENT_ACTION_LABEL: Record<B2bPaymentStatusValue, string> = {
  PAID: 'Marcar como pagado',
  PENDING: 'Marcar pago como pendiente',
  REFUNDED: 'Registrar reembolso',
  CANCELLED: 'Anular pago',
};
const FULFILLMENT_ACTION_LABEL: Partial<Record<B2bFulfillmentStatusValue, string>> = {
  PROCESSING: 'Marcar en preparación',
  PENDING: 'Volver a "sin preparar"',
  SHIPPED: 'Marcar como enviado',
  DELIVERED: 'Marcar como entregado',
  RETURNED: 'Registrar devolución',
};

type Panel =
  | null
  | 'ship'
  | 'tracking'
  | 'paid'
  | 'cancel'
  | 'return'
  | 'reject'
  | 'accept-invoice'
  | 'invoice'
  | { rectify: string };

/** Mirrors normalizeManualDocumentNumber() in src/lib/b2b/order-numbers.ts (server re-validates). */
const INVOICE_NUMBER_RE = /^[A-Z0-9][A-Z0-9-]{2,49}$/;

function InvoiceNumberField({ id, value, onChange, label = 'Número de factura *' }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const invalid = value !== '' && !INVOICE_NUMBER_RE.test(value.trim());
  return (
    <div className="max-w-sm">
      <label htmlFor={id} className="block text-xs text-text-secondary mb-1">{label}</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        maxLength={50}
        className={`${inputClass} font-mono uppercase`}
        placeholder="Ej. FAC-2026-000123"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className={`mt-1 text-xs ${invalid ? 'text-danger' : 'text-text-secondary'}`}>
        Número de tu contabilidad. Letras, números y guiones (3-50). Debe ser único.
      </p>
    </div>
  );
}

async function call(url: string, body?: unknown, method = 'POST') {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function AdminB2bOrderDetailModal({ orderId, notify, onClose, onChanged }: AdminB2bOrderDetailModalProps) {
  const [order, setOrder] = useState<B2bAdminOrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  const [carrier, setCarrier] = useState<ShippingProvider | ''>('');
  const [tracking, setTracking] = useState('');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState('Transferencia bancaria');
  const [paymentReference, setPaymentReference] = useState('');
  const [reason, setReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [emailOnGenerate, setEmailOnGenerate] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const invoiceNumberValid = INVOICE_NUMBER_RE.test(invoiceNumber.trim());
  const openPanel = (p: Panel) => {
    setInvoiceNumber('');
    setReason('');
    setPanel(p);
  };

  const applyOrder = useCallback((o: B2bAdminOrderDetail) => {
    setOrder(o);
    setInternalNotes(o.internalNotes ?? '');
    setCustomerNotes(o.notes ?? '');
  }, []);

  const load = useCallback(async () => {
    const r = await call(`/api/admin/b2b/orders/${orderId}`, undefined, 'GET');
    if (r.ok) {
      applyOrder(r.data.order);
      setLoadError(null);
    } else {
      setLoadError(r.data.error ?? 'No se pudo cargar el pedido.');
    }
  }, [orderId, applyOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run an action, report the outcome and refresh both the detail and the list. */
  const act = async (key: string, url: string, body: unknown, success: string, method = 'POST') => {
    setBusy(key);
    try {
      const r = await call(url, body, method);
      if (!r.ok && r.status !== 202) {
        notify('error', r.data.error ?? 'No se pudo completar la acción.');
        return false;
      }
      if (r.status === 202 || r.data.error) {
        notify('error', `${r.data.error ?? 'La generación del documento ha fallado.'} Puedes reintentarlo.`);
      } else {
        const extra = r.data.email && !r.data.email.sent ? ` Aviso: ${r.data.email.error}` : '';
        notify(r.data.email && !r.data.email.sent ? 'error' : 'success', `${success}${extra}`);
      }
      if (r.data.order && 'events' in r.data.order) applyOrder(r.data.order);
      else await load();
      onChanged();
      setPanel(null);
      setReason('');
      return true;
    } catch {
      notify('error', 'Error de red. Inténtalo de nuevo.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!order) {
    return (
      <Modal title="Pedido B2B" onClose={onClose} wide>
        <p className="text-sm text-text-secondary" role={loadError ? 'alert' : undefined}>
          {loadError ?? 'Cargando…'}
        </p>
      </Modal>
    );
  }

  const base = `/api/admin/b2b/orders/${order.id}`;
  const state: B2bOrderState = {
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
  };
  const docStates = order.documents.map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    correctsDocumentId: d.correctsDocumentId,
  }));
  const eligible = (t: B2bDocumentTypeValue) => getDocumentEligibility(state, docStates, t).ok;
  const activeInvoice = order.documents.find(
    (d) => d.type === 'INVOICE' && d.status === 'ISSUED' && !isRectified(d, docStates)
  );
  const paymentTargets = allowedPaymentTargets(state);
  const fulfillmentTargets = allowedFulfillmentTargets(state);
  const canEditTracking = order.fulfillmentStatus === 'SHIPPED' && canChangeFulfillment(state, 'SHIPPED').ok;
  const isBusy = busy !== null;

  const alerts: string[] = [];
  if ((order.status === 'CANCELLED' || order.status === 'REJECTED') && order.paymentStatus === 'PAID') {
    alerts.push('El pedido está cancelado pero el pago sigue cobrado: registra el reembolso cuando se realice.');
  }
  if (order.fulfillmentStatus === 'RETURNED' && order.paymentStatus === 'PAID') {
    alerts.push('Pedido devuelto con el pago cobrado: el reembolso no se registra automáticamente.');
  }
  if (
    activeInvoice &&
    (order.status === 'CANCELLED' || order.fulfillmentStatus === 'RETURNED' || order.paymentStatus === 'REFUNDED')
  ) {
    alerts.push(`La factura ${activeInvoice.number} sigue vigente: si procede, emite una factura rectificativa.`);
  }
  if (order.shippingEmailError) alerts.push(`Email de envío: ${order.shippingEmailError}`);
  order.documents
    .filter((d) => d.status === 'FAILED')
    .forEach((d) => alerts.push(`${B2B_DOCUMENT_TYPE_LABEL[d.type]} ${d.number}: ${d.lastError ?? 'error de generación'}`));

  const isRetryable = (d: B2bAdminDocumentView) =>
    d.status === 'FAILED' ||
    (d.status === 'GENERATING' &&
      (!d.lastAttemptAt || Date.now() - new Date(d.lastAttemptAt).getTime() > GENERATION_LOCK_MS));

  const generate = (type: B2bDocumentTypeValue, number?: string) => {
    if (
      type === 'INVOICE' &&
      !window.confirm(
        `Se emitirá la FACTURA DEFINITIVA ${number} de ${eurFmt.format(order.total)}. Una factura emitida no puede modificarse ni eliminarse, solo rectificarse. ¿Continuar?`
      )
    ) {
      return;
    }
    void act(
      `doc-${type}`,
      `${base}/documents`,
      { type, notifyCustomer: emailOnGenerate, ...(number && { number }) },
      `${B2B_DOCUMENT_TYPE_LABEL[type]} generada correctamente.`
    );
  };

  return (
    <Modal
      title={`Pedido ${order.orderNumber}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span>{formatDateTime(order.createdAt)}</span>
          <Badge className="bg-dark-bg text-text-muted">
            {order.source === 'ADMIN' ? 'Creado por administrador' : 'Creado por el cliente'}
          </Badge>
          <LifecycleBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
          <FulfillmentBadge status={order.fulfillmentStatus} />
        </span>
      }
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {alerts.length > 0 && (
          <div role="status" className="rounded-xl border border-warning/40 bg-warning-bg p-3 text-sm text-warning space-y-1">
            {alerts.map((a) => (
              <p key={a}>⚠ {a}</p>
            ))}
          </div>
        )}

        {/* Lifecycle */}
        {(order.status === 'PENDING' || canCancel(state, 'admin').ok) && (
          <Section title="Pedido">
            <div className="flex flex-wrap gap-2">
              {order.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    className={btnFiscal}
                    disabled={isBusy}
                    onClick={() => openPanel('accept-invoice')}
                  >
                    Confirmar y emitir factura
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={isBusy}
                    onClick={() => void act('accept', `${base}/accept`, { generateInvoice: false }, 'Pedido confirmado.')}
                  >
                    Confirmar sin factura
                  </button>
                  <button type="button" className={btnSecondary} disabled={isBusy} onClick={() => setPanel('reject')}>
                    Rechazar
                  </button>
                </>
              )}
              {canCancel(state, 'admin').ok && (
                <button type="button" className={btnDanger} disabled={isBusy} onClick={() => setPanel('cancel')}>
                  Cancelar pedido
                </button>
              )}
            </div>
            {panel === 'accept-invoice' && (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!invoiceNumberValid) return;
                  if (!window.confirm(`Se confirmará el pedido y se emitirá la FACTURA DEFINITIVA ${invoiceNumber.trim()} de ${eurFmt.format(order.total)}. ¿Continuar?`)) return;
                  void act(
                    'accept',
                    `${base}/accept`,
                    { generateInvoice: true, invoiceNumber: invoiceNumber.trim() },
                    `Pedido confirmado y factura ${invoiceNumber.trim()} emitida.`
                  );
                }}
              >
                <InvoiceNumberField id="b2b-accept-invoice-number" value={invoiceNumber} onChange={setInvoiceNumber} />
                <div className="flex gap-2">
                  <button type="submit" className={btnFiscal} disabled={isBusy || !invoiceNumberValid}>
                    Confirmar y emitir factura
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>Volver</button>
                </div>
              </form>
            )}
            {(panel === 'cancel' || panel === 'reject') && (
              <div className="mt-3 space-y-2">
                <label htmlFor="b2b-reason" className="block text-xs text-text-secondary">
                  Motivo {panel === 'cancel' ? 'de la cancelación' : 'del rechazo'} (opcional, visible para el cliente)
                </label>
                <textarea id="b2b-reason" rows={2} maxLength={1000} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                {panel === 'cancel' && order.paymentStatus === 'PAID' && (
                  <p className="text-xs text-warning">El pago está cobrado: la cancelación NO registra el reembolso.</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnDanger}
                    disabled={isBusy}
                    onClick={() =>
                      void act(
                        panel,
                        `${base}/${panel}`,
                        { reason },
                        panel === 'cancel' ? 'Pedido cancelado.' : 'Pedido rechazado.'
                      )
                    }
                  >
                    {panel === 'cancel' ? 'Confirmar cancelación' : 'Confirmar rechazo'}
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>
                    Volver
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Payment */}
          <Section title="Pago">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-text-muted">Estado</dt>
              <dd><PaymentBadge status={order.paymentStatus} /></dd>
              <dt className="text-text-muted">Fecha de pago</dt>
              <dd className="text-text-primary">{formatDate(order.paidAt)}</dd>
              <dt className="text-text-muted">Método</dt>
              <dd className="text-text-primary">{order.paymentMethod ?? '—'}</dd>
              <dt className="text-text-muted">Referencia</dt>
              <dd className="text-text-primary break-all">{order.paymentReference ?? '—'}</dd>
              {order.refundedAt && (
                <>
                  <dt className="text-text-muted">Reembolsado</dt>
                  <dd className="text-text-primary">{formatDateTime(order.refundedAt)}</dd>
                </>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {paymentTargets.map((to) => (
                <button
                  key={to}
                  type="button"
                  className={to === 'PAID' ? btnPrimary : btnSecondary}
                  disabled={isBusy}
                  onClick={() => {
                    if (to === 'PAID') {
                      setPanel('paid');
                      return;
                    }
                    if (window.confirm(`${PAYMENT_ACTION_LABEL[to]}?`)) {
                      void act(`pay-${to}`, `${base}/payment`, { status: to }, 'Estado de pago actualizado.');
                    }
                  }}
                >
                  {PAYMENT_ACTION_LABEL[to]}
                </button>
              ))}
              {paymentTargets.length === 0 && <p className="text-xs text-text-muted">No hay acciones de pago disponibles.</p>}
            </div>
            {panel === 'paid' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div>
                  <label htmlFor="b2b-paid-at" className="block text-xs text-text-secondary mb-1">Fecha de pago</label>
                  <input id="b2b-paid-at" type="date" max={todayIso()} className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="b2b-paid-method" className="block text-xs text-text-secondary mb-1">Método</label>
                  <input id="b2b-paid-method" maxLength={60} className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="b2b-paid-ref" className="block text-xs text-text-secondary mb-1">Referencia (opcional)</label>
                  <input id="b2b-paid-ref" maxLength={120} className={inputClass} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                </div>
                <div className="sm:col-span-3 flex gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={isBusy || !paidAt}
                    onClick={() =>
                      void act(
                        'pay-PAID',
                        `${base}/payment`,
                        { status: 'PAID', paidAt, method: paymentMethod, reference: paymentReference },
                        'Pedido marcado como pagado.'
                      )
                    }
                  >
                    Confirmar pago
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>Volver</button>
                </div>
              </div>
            )}
          </Section>

          {/* Shipping */}
          <Section title="Envío">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-text-muted">Estado</dt>
              <dd><FulfillmentBadge status={order.fulfillmentStatus} /></dd>
              <dt className="text-text-muted">Transportista</dt>
              <dd className="text-text-primary">{carrierLabel(order.shippingProvider)}</dd>
              <dt className="text-text-muted">Seguimiento</dt>
              <dd className="text-text-primary break-all">
                {order.trackingNumber ? (
                  order.trackingUrl ? (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-premium-gold hover:underline">
                      {order.trackingNumber}
                    </a>
                  ) : (
                    order.trackingNumber
                  )
                ) : (
                  '—'
                )}
              </dd>
              {order.shippedAt && (<><dt className="text-text-muted">Enviado</dt><dd className="text-text-primary">{formatDateTime(order.shippedAt)}</dd></>)}
              {order.deliveredAt && (<><dt className="text-text-muted">Entregado</dt><dd className="text-text-primary">{formatDateTime(order.deliveredAt)}</dd></>)}
              {order.returnedAt && (<><dt className="text-text-muted">Devuelto</dt><dd className="text-text-primary">{formatDateTime(order.returnedAt)}{order.returnReason ? ` · ${order.returnReason}` : ''}</dd></>)}
              {(order.fulfillmentStatus === 'SHIPPED' || order.fulfillmentStatus === 'DELIVERED') && (
                <>
                  <dt className="text-text-muted">Email de envío</dt>
                  <dd className="text-text-primary">
                    {order.shippingEmailSentAt
                      ? `Enviado ${formatDateTime(order.shippingEmailSentAt)}`
                      : order.shippingEmailError
                        ? <span className="text-danger">Fallido</span>
                        : 'No enviado'}
                  </dd>
                </>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {fulfillmentTargets.map((to) => (
                <button
                  key={to}
                  type="button"
                  className={to === 'SHIPPED' ? btnPrimary : btnSecondary}
                  disabled={isBusy}
                  onClick={() => {
                    if (to === 'SHIPPED') {
                      setCarrier('');
                      setTracking('');
                      setPanel('ship');
                    } else if (to === 'RETURNED') {
                      setPanel('return');
                    } else if (window.confirm(`${FULFILLMENT_ACTION_LABEL[to]}?`)) {
                      void act(`ful-${to}`, `${base}/fulfillment`, { status: to }, 'Estado de envío actualizado.');
                    }
                  }}
                >
                  {FULFILLMENT_ACTION_LABEL[to]}
                </button>
              ))}
              {canEditTracking && (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={isBusy}
                  onClick={() => {
                    setCarrier((order.shippingProvider as ShippingProvider) ?? '');
                    setTracking(order.trackingNumber ?? '');
                    setPanel('tracking');
                  }}
                >
                  Editar seguimiento
                </button>
              )}
              {(order.fulfillmentStatus === 'SHIPPED' || order.fulfillmentStatus === 'DELIVERED') && order.trackingNumber && (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={isBusy}
                  onClick={() => void act('ship-email', `${base}/shipping-email`, {}, 'Email de envío enviado.')}
                >
                  {order.shippingEmailSentAt ? 'Reenviar email de envío' : 'Reintentar email de envío'}
                </button>
              )}
            </div>
            {(panel === 'ship' || panel === 'tracking') && (
              <form
                className="mt-3 grid gap-2 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    panel,
                    `${base}/fulfillment`,
                    { status: 'SHIPPED', shippingProvider: carrier, trackingNumber: tracking },
                    panel === 'ship' ? 'Pedido marcado como enviado.' : 'Datos de seguimiento actualizados.'
                  );
                }}
              >
                <div>
                  <label htmlFor="b2b-carrier" className="block text-xs text-text-secondary mb-1">Transportista *</label>
                  <select id="b2b-carrier" required className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value as ShippingProvider)}>
                    <option value="">Selecciona…</option>
                    {CARRIERS.map((c) => (
                      <option key={c} value={c}>{getProviderLabel(c)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="b2b-tracking" className="block text-xs text-text-secondary mb-1">Nº de seguimiento *</label>
                  <input id="b2b-tracking" required minLength={3} maxLength={100} className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </div>
                <p className="sm:col-span-2 text-xs text-text-secondary">
                  {panel === 'ship'
                    ? 'Al confirmar se guardará el envío y se notificará al cliente por email.'
                    : 'La modificación no reenvía el email automáticamente.'}
                </p>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" className={btnPrimary} disabled={isBusy || !carrier || tracking.trim().length < 3}>
                    {panel === 'ship' ? 'Confirmar envío' : 'Guardar seguimiento'}
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>Volver</button>
                </div>
              </form>
            )}
            {panel === 'return' && (
              <div className="mt-3 space-y-2">
                <label htmlFor="b2b-return-reason" className="block text-xs text-text-secondary">Motivo de la devolución (opcional)</label>
                <textarea id="b2b-return-reason" rows={2} maxLength={1000} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                <p className="text-xs text-text-secondary">El estado de pago no cambia: registra el reembolso por separado si se realiza.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnDanger}
                    disabled={isBusy}
                    onClick={() => void act('return', `${base}/fulfillment`, { status: 'RETURNED', reason }, 'Devolución registrada.')}
                  >
                    Confirmar devolución
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>Volver</button>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Documents */}
        <Section title="Documentos">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {eligible('INVOICE') && (
              <button type="button" className={btnFiscal} disabled={isBusy} onClick={() => openPanel('invoice')}>
                Emitir factura definitiva
              </button>
            )}
            {eligible('PROFORMA') && (
              <button type="button" className={btnSecondary} disabled={isBusy} onClick={() => generate('PROFORMA')}>
                Generar proforma <span className="text-xs text-text-muted">(sin validez fiscal)</span>
              </button>
            )}
            {eligible('QUOTATION') && (
              <button type="button" className={btnSecondary} disabled={isBusy} onClick={() => generate('QUOTATION')}>
                Generar presupuesto <span className="text-xs text-text-muted">(sin validez fiscal)</span>
              </button>
            )}
            {(eligible('INVOICE') || eligible('PROFORMA') || eligible('QUOTATION')) && (
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" className="accent-premium-gold" checked={emailOnGenerate} onChange={(e) => setEmailOnGenerate(e.target.checked)} />
                Enviar al cliente por email al generar
              </label>
            )}
          </div>
          {panel === 'invoice' && eligible('INVOICE') && (
            <form
              className="mb-4 space-y-2 rounded-lg border border-red-500/40 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (invoiceNumberValid) generate('INVOICE', invoiceNumber.trim());
              }}
            >
              <InvoiceNumberField id="b2b-invoice-number" value={invoiceNumber} onChange={setInvoiceNumber} />
              <div className="flex gap-2">
                <button type="submit" className={btnFiscal} disabled={isBusy || !invoiceNumberValid}>
                  Emitir factura
                </button>
                <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>Volver</button>
              </div>
            </form>
          )}

          {order.documents.length === 0 ? (
            <p className="text-sm text-text-muted">Este pedido no tiene documentos.</p>
          ) : (
            <ul className="divide-y divide-dark-border">
              {order.documents.map((d) => {
                const fiscal = FISCAL_DOCUMENT_TYPES.includes(d.type);
                const rectifiable = d.type === 'INVOICE' && d.status === 'ISSUED' && d.correctedByNumbers.length === 0;
                return (
                  <li key={d.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text-primary">{B2B_DOCUMENT_TYPE_LABEL[d.type]}</span>
                          <span className="font-mono text-text-primary">{d.number}</span>
                          <Badge className={fiscal ? 'bg-red-500/15 text-red-300' : 'bg-dark-bg text-text-muted'}>
                            {fiscal ? 'Fiscal' : 'Preliminar'}
                          </Badge>
                          <DocumentStatusBadge status={d.status} />
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                          Emisión {formatDateTime(d.issuedAt)} · {eurFmt.format(d.total)} · {d.attempts} intento{d.attempts === 1 ? '' : 's'}
                          {d.correctsNumber && ` · Rectifica ${d.correctsNumber}`}
                          {d.correctedByNumbers.length > 0 && ` · Rectificada por ${d.correctedByNumbers.join(', ')}`}
                        </div>
                        {d.correctionReason && <div className="text-xs text-text-secondary">Motivo: {d.correctionReason}</div>}
                        {d.lastError && d.status !== 'ISSUED' && <div className="text-xs text-danger mt-1">{d.lastError}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.status === 'ISSUED' && (
                          <>
                            <a className={btnSecondary} href={`${base}/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
                              Ver<span className="sr-only"> {d.number}</span>
                            </a>
                            <a className={btnSecondary} href={`${base}/documents/${d.id}?download=1`}>
                              Descargar<span className="sr-only"> {d.number}</span>
                            </a>
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={isBusy}
                              onClick={() => void act(`send-${d.id}`, `${base}/documents/${d.id}/send`, {}, `${d.number} enviado al cliente.`)}
                            >
                              Enviar al cliente
                            </button>
                          </>
                        )}
                        {isRetryable(d) && (
                          <button
                            type="button"
                            className={btnPrimary}
                            disabled={isBusy}
                            onClick={() => void act(`retry-${d.id}`, `${base}/documents/${d.id}/retry`, {}, `${d.number} generado correctamente.`)}
                          >
                            {busy === `retry-${d.id}` ? 'Reintentando…' : 'Reintentar'}
                          </button>
                        )}
                        {rectifiable && (
                          <button type="button" className={btnFiscal} disabled={isBusy} onClick={() => openPanel({ rectify: d.id })}>
                            Rectificar
                          </button>
                        )}
                      </div>
                    </div>
                    {panel && typeof panel === 'object' && panel.rectify === d.id && (
                      <div className="mt-3 space-y-2">
                        <label htmlFor={`rect-${d.id}`} className="block text-xs text-text-secondary">
                          Motivo de la rectificación * (aparecerá en la factura rectificativa)
                        </label>
                        <textarea id={`rect-${d.id}`} rows={2} maxLength={1000} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                        <InvoiceNumberField
                          id={`rect-number-${d.id}`}
                          label="Número de la factura rectificativa *"
                          value={invoiceNumber}
                          onChange={setInvoiceNumber}
                        />
                        <p className="text-xs text-text-secondary">
                          Se emitirá una factura rectificativa que anula íntegramente {d.number}. La factura original no se modifica.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={btnFiscal}
                            disabled={isBusy || reason.trim().length < 3 || !invoiceNumberValid}
                            onClick={() =>
                              void act(
                                `rect-${d.id}`,
                                `${base}/documents`,
                                { type: 'CORRECTIVE_INVOICE', correctsDocumentId: d.id, reason, number: invoiceNumber.trim(), notifyCustomer: emailOnGenerate },
                                'Factura rectificativa emitida.'
                              )
                            }
                          >
                            Emitir factura rectificativa
                          </button>
                          <button type="button" className={btnSecondary} onClick={() => setPanel(null)}>Volver</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Lines */}
        <Section title="Productos">
          <B2bOrderLinesTable items={order.items} totals={order} />
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Cliente (datos del pedido)">
            <div className="text-sm space-y-0.5 text-text-secondary">
              <div className="font-semibold text-text-primary">{order.customer.companyName}</div>
              <div>NIF/CIF: {order.customer.vatNumber}</div>
              <div>{order.customer.contactName}</div>
              <div>{order.customer.email} · {order.customer.phone}</div>
              <div className="pt-2 text-xs uppercase text-text-muted">Facturación</div>
              <div className="whitespace-pre-line">{order.customer.billingAddress || order.customer.shippingAddress}</div>
              <div className="pt-2 text-xs uppercase text-text-muted">Envío</div>
              <div className="whitespace-pre-line">{order.customer.shippingAddress}</div>
              {order.cancellationReason && <div className="pt-2">Motivo de cancelación/rechazo: {order.cancellationReason}</div>}
            </div>
          </Section>

          <Section title="Notas">
            <div className="space-y-3">
              <div>
                <label htmlFor="b2b-internal-notes" className="block text-xs text-text-secondary mb-1">
                  Notas internas <span className="text-text-muted">(nunca visibles para el cliente)</span>
                </label>
                <textarea id="b2b-internal-notes" rows={3} maxLength={5000} className={inputClass} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
                <button
                  type="button"
                  className={`${btnSecondary} mt-1`}
                  disabled={isBusy || internalNotes === (order.internalNotes ?? '')}
                  onClick={() => void act('notes-internal', base, { internalNotes }, 'Nota interna guardada.', 'PATCH')}
                >
                  Guardar nota interna
                </button>
              </div>
              <div>
                <label htmlFor="b2b-customer-notes" className="block text-xs text-text-secondary mb-1">
                  Notas visibles para el cliente
                </label>
                <textarea id="b2b-customer-notes" rows={3} maxLength={2000} className={inputClass} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
                <button
                  type="button"
                  className={`${btnSecondary} mt-1`}
                  disabled={isBusy || customerNotes === (order.notes ?? '')}
                  onClick={() => void act('notes-customer', base, { notes: customerNotes }, 'Nota del cliente guardada.', 'PATCH')}
                >
                  Guardar nota del cliente
                </button>
              </div>
            </div>
          </Section>
        </div>

        {/* History */}
        <Section title="Historial del pedido">
          {order.events.length === 0 ? (
            <p className="text-sm text-text-muted">Sin eventos registrados.</p>
          ) : (
            <ol className="space-y-2">
              {order.events.map((e) => {
                const { label, detail } = describeEvent(e);
                const failed = e.type.endsWith('FAILED');
                return (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span aria-hidden="true" className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${failed ? 'bg-danger' : 'bg-premium-gold'}`} />
                    <div className="min-w-0">
                      <div className={failed ? 'text-danger' : 'text-text-primary'}>{label}</div>
                      <div className="text-xs text-text-muted">
                        {formatDateTime(e.createdAt)}
                        {e.actor ? ` · ${e.actor}` : ''}
                        {detail ? ` · ${detail}` : ''}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </Modal>
  );
}
