'use client';

/**
 * Shared presentational helpers for the B2B order screens (admin + customer):
 * formatters, status badges, an accessible modal and audit-event labels.
 * Business rules live in `src/lib/b2b/order-status.ts`, not here.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type {
  B2bDocumentStatusValue,
  B2bFulfillmentStatusValue,
  B2bOrderEventView,
  B2bOrderLifecycleStatus,
  B2bPaymentStatusValue,
} from '@/types';
import {
  B2B_DOCUMENT_STATUS_LABEL,
  B2B_DOCUMENT_TYPE_LABEL,
  B2B_FULFILLMENT_STATUS_LABEL,
  B2B_ORDER_STATUS_LABEL,
  B2B_PAYMENT_STATUS_LABEL,
} from '@/lib/b2b/order-status';
import { getProviderLabel, type ShippingProvider } from '@/lib/shipping/tracking-urls';

export const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const dateTimeFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '—';
}
export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}
export function carrierLabel(provider: string | null | undefined): string {
  return provider ? getProviderLabel(provider as ShippingProvider) : '—';
}

export const inputClass =
  'w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-premium-gold focus:border-premium-gold disabled:opacity-60';
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-premium-gold text-dark-bg text-sm font-semibold hover:bg-premium-gold_dark focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold focus-visible:ring-offset-2 focus-visible:ring-offset-dark-surface disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-dark-borderStrong text-text-primary text-sm font-medium hover:bg-dark-surfaceHover focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold disabled:opacity-50 disabled:cursor-not-allowed';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-danger text-dark-bg text-sm font-semibold hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50 disabled:cursor-not-allowed';
export const btnFiscal =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed';

const NEUTRAL = 'bg-dark-surfaceHover text-text-secondary';

export const LIFECYCLE_BADGE: Record<B2bOrderLifecycleStatus, string> = {
  PENDING: 'bg-warning-bg text-warning',
  ACCEPTED: 'bg-success-bg text-success',
  CANCELLED: NEUTRAL,
  REJECTED: 'bg-danger-bg text-danger',
};
export const PAYMENT_BADGE: Record<B2bPaymentStatusValue, string> = {
  PENDING: 'bg-warning-bg text-warning',
  PAID: 'bg-success-bg text-success',
  REFUNDED: 'bg-premium-gold/15 text-premium-gold',
  CANCELLED: NEUTRAL,
};
export const FULFILLMENT_BADGE: Record<B2bFulfillmentStatusValue, string> = {
  PENDING: NEUTRAL,
  PROCESSING: 'bg-warning-bg text-warning',
  SHIPPED: 'bg-premium-gold/15 text-premium-gold',
  DELIVERED: 'bg-success-bg text-success',
  RETURNED: 'bg-danger-bg text-danger',
  CANCELLED: NEUTRAL,
};
export const DOCUMENT_STATUS_BADGE: Record<B2bDocumentStatusValue, string> = {
  GENERATING: 'bg-warning-bg text-warning',
  ISSUED: 'bg-success-bg text-success',
  FAILED: 'bg-danger-bg text-danger',
};

export function Badge({ className, children, title }: { className: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function LifecycleBadge({ status }: { status: B2bOrderLifecycleStatus }) {
  return <Badge className={LIFECYCLE_BADGE[status]}>{B2B_ORDER_STATUS_LABEL[status]}</Badge>;
}
export function PaymentBadge({ status }: { status: B2bPaymentStatusValue }) {
  return <Badge className={PAYMENT_BADGE[status]}>{B2B_PAYMENT_STATUS_LABEL[status]}</Badge>;
}
export function FulfillmentBadge({ status }: { status: B2bFulfillmentStatusValue }) {
  return <Badge className={FULFILLMENT_BADGE[status]}>{B2B_FULFILLMENT_STATUS_LABEL[status]}</Badge>;
}
export function DocumentStatusBadge({ status }: { status: B2bDocumentStatusValue }) {
  return <Badge className={DOCUMENT_STATUS_BADGE[status]}>{B2B_DOCUMENT_STATUS_LABEL[status]}</Badge>;
}

interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Accessible dialog: labelled, Escape closes, focus moves in, is trapped, and is restored on close. */
export function Modal({ title, subtitle, onClose, children, footer, wide = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`b2b-modal-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} bg-dark-surface border border-dark-border rounded-2xl shadow-2xl focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-dark-border">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-text-primary">
              {title}
            </h2>
            {subtitle && <div className="text-xs text-text-secondary mt-1">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold rounded"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-dark-border flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-dark-border bg-dark-bgSecondary p-4" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ── Audit events ────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  ORDER_CREATED: 'Pedido creado por el cliente',
  ORDER_CREATED_BY_ADMIN: 'Pedido creado manualmente por un administrador',
  ORDER_ACCEPTED: 'Pedido confirmado',
  ORDER_REJECTED: 'Pedido rechazado',
  ORDER_UPDATED: 'Pedido actualizado',
  ORDER_CANCELLED: 'Pedido cancelado',
  PAYMENT_STATUS_CHANGED: 'Estado de pago modificado',
  FULFILLMENT_STATUS_CHANGED: 'Estado de envío modificado',
  ORDER_SHIPPED: 'Pedido marcado como enviado',
  ORDER_DELIVERED: 'Pedido marcado como entregado',
  ORDER_RETURNED: 'Pedido marcado como devuelto',
  TRACKING_UPDATED: 'Número de seguimiento modificado',
  CARRIER_CHANGED: 'Transportista modificado',
  ADMIN_NOTE_UPDATED: 'Nota interna actualizada',
  CUSTOMER_NOTE_UPDATED: 'Nota visible para el cliente actualizada',
  DOCUMENT_GENERATED: 'Documento generado',
  DOCUMENT_GENERATION_FAILED: 'Error al generar documento',
  DOCUMENT_GENERATION_RETRIED: 'Reintento de generación de documento',
  DOCUMENT_EMAIL_SENT: 'Documento enviado por email',
  DOCUMENT_EMAIL_FAILED: 'Error al enviar documento por email',
  SHIPPING_EMAIL_SENT: 'Email de envío enviado',
  SHIPPING_EMAIL_FAILED: 'Error al enviar email de envío',
  SHIPPING_EMAIL_RETRIED: 'Reintento de email de envío',
};

export function describeEvent(e: B2bOrderEventView): { label: string; detail: string | null } {
  const m = e.metadata ?? {};
  const s = (k: string): string | null => (typeof m[k] === 'string' ? (m[k] as string) : null);
  const docType = s('type');
  let label = EVENT_LABEL[e.type] ?? e.type;
  if (docType && docType in B2B_DOCUMENT_TYPE_LABEL && e.type.startsWith('DOCUMENT_GENERAT')) {
    label = `${label}: ${B2B_DOCUMENT_TYPE_LABEL[docType as keyof typeof B2B_DOCUMENT_TYPE_LABEL]}`;
  }

  const parts: string[] = [];
  const number = s('number');
  if (number) parts.push(number);
  if (e.type === 'PAYMENT_STATUS_CHANGED') {
    const from = s('from') as B2bPaymentStatusValue | null;
    const to = s('to') as B2bPaymentStatusValue | null;
    if (from && to) parts.push(`${B2B_PAYMENT_STATUS_LABEL[from]} → ${B2B_PAYMENT_STATUS_LABEL[to]}`);
    const method = s('method');
    const reference = s('reference');
    if (method) parts.push(method);
    if (reference) parts.push(`Ref. ${reference}`);
  }
  if (e.type === 'FULFILLMENT_STATUS_CHANGED') {
    const from = s('from') as B2bFulfillmentStatusValue | null;
    const to = s('to') as B2bFulfillmentStatusValue | null;
    if (from && to) parts.push(`${B2B_FULFILLMENT_STATUS_LABEL[from]} → ${B2B_FULFILLMENT_STATUS_LABEL[to]}`);
  }
  if (e.type === 'ORDER_SHIPPED') parts.push(`${carrierLabel(s('shippingProvider'))} · ${s('trackingNumber') ?? ''}`);
  if (e.type === 'TRACKING_UPDATED') parts.push(`${s('from') ?? '—'} → ${s('to') ?? '—'}`);
  if (e.type === 'CARRIER_CHANGED') parts.push(`${carrierLabel(s('from'))} → ${carrierLabel(s('to'))}`);
  const reason = s('reason');
  if (reason) parts.push(`Motivo: ${reason}`);
  const note = s('note');
  if (note) parts.push(`“${note}”`);
  const to = s('to');
  if (to && e.type.endsWith('EMAIL_SENT')) parts.push(`a ${to}`);
  const error = s('error');
  if (error) parts.push(error);
  if (m.requiresRefund === true) parts.push('Requiere reembolso');
  if (m.requiresCorrectiveInvoice === true) parts.push('Requiere factura rectificativa');
  if (m.legacy === true) parts.push('Registro anterior al historial');
  if (typeof m.total === 'number') parts.push(eurFmt.format(m.total));
  return { label, detail: parts.length > 0 ? parts.join(' · ') : null };
}
