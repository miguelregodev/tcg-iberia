'use client';

/**
 * B2B customer order detail (customer portal). Renders only the customer
 * projection returned by GET /api/b2b/orders/[id] — no internal notes,
 * audit events or storage details exist in that payload.
 */

import type { B2bCustomerOrderDetail } from '@/types';
import { B2B_DOCUMENT_TYPE_LABEL } from '@/lib/b2b/order-status';
import {
  FulfillmentBadge,
  PaymentBadge,
  carrierLabel,
  eurFmt,
  formatDate,
  formatDateTime,
} from './B2bOrderUi';
import { B2bOrderLinesTable } from './B2bOrderLinesTable';

interface B2bCustomerOrderDetailViewProps {
  order: B2bCustomerOrderDetail;
}

export function B2bCustomerOrderDetailView({ order }: B2bCustomerOrderDetailViewProps) {
  const timeline: Array<[string, string | null, boolean?]> = [
    ['Pedido realizado', order.createdAt],
    ['Pedido confirmado', order.acceptedAt],
    ['Pago recibido', order.paidAt, true],
    ['Enviado', order.shippedAt],
    ['Entregado', order.deliveredAt],
    ['Devuelto', order.returnedAt],
    ['Reembolsado', order.refundedAt],
    [order.status === 'REJECTED' ? 'Rechazado' : 'Cancelado', order.cancelledAt],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-dark-border bg-dark-bgSecondary p-4">
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Pago</h4>
          <PaymentBadge status={order.paymentStatus} />
          <p className="mt-2 text-sm text-text-secondary">
            {order.paymentStatus === 'PAID'
              ? `Pagado el ${formatDate(order.paidAt)}`
              : order.paymentStatus === 'PENDING'
                ? `Importe pendiente: ${eurFmt.format(order.total)}`
                : order.paymentStatus === 'REFUNDED'
                  ? `Reembolsado el ${formatDate(order.refundedAt)}`
                  : 'Pago anulado'}
          </p>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-bgSecondary p-4">
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Envío</h4>
          <FulfillmentBadge status={order.fulfillmentStatus} />
          {order.trackingNumber ? (
            <p className="mt-2 text-sm text-text-secondary">
              {carrierLabel(order.shippingProvider)} ·{' '}
              {order.trackingUrl ? (
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-premium-gold hover:underline">
                  {order.trackingNumber}
                  <span className="sr-only"> (abre la web del transportista)</span>
                </a>
              ) : (
                <span className="font-mono">{order.trackingNumber}</span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">Aún sin datos de seguimiento.</p>
          )}
        </div>
        <div className="sm:col-span-2 rounded-xl border border-dark-border bg-dark-bgSecondary p-4">
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Seguimiento del pedido</h4>
          <ol className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {timeline
              .filter(([, at]) => at)
              .map(([label, at, dateOnly]) => (
                <li key={label} className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-text-secondary">{label}</span>
                  <span className="text-text-primary">{dateOnly ? formatDate(at) : formatDateTime(at)}</span>
                </li>
              ))}
          </ol>
        </div>
      </div>

      <section aria-label="Productos">
        <B2bOrderLinesTable items={order.items} totals={order} showImages />
      </section>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-1">Dirección de facturación</h4>
          <p className="text-text-secondary whitespace-pre-line">
            {order.customer.companyName}
            {'\n'}NIF/CIF: {order.customer.vatNumber}
            {'\n'}
            {order.customer.billingAddress || order.customer.shippingAddress}
          </p>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-1">Dirección de envío</h4>
          <p className="text-text-secondary whitespace-pre-line">{order.customer.shippingAddress}</p>
        </div>
      </div>

      {(order.notes || order.cancellationReason) && (
        <div className="p-3 rounded-lg bg-dark-bgSecondary border border-dark-border text-sm text-text-secondary space-y-1">
          {order.notes && (
            <p>
              <strong className="text-text-primary">Notas:</strong> {order.notes}
            </p>
          )}
          {order.cancellationReason && (
            <p>
              <strong className="text-text-primary">Motivo:</strong> {order.cancellationReason}
            </p>
          )}
        </div>
      )}

      <section aria-label="Documentos" className="rounded-xl border border-dark-border p-4">
        <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Facturas y documentos</h4>
        {order.documents.length === 0 ? (
          <p className="text-sm text-text-secondary">Todavía no se ha emitido ninguna factura para este pedido.</p>
        ) : (
          <ul className="divide-y divide-dark-border">
            {order.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="text-text-primary">
                    {B2B_DOCUMENT_TYPE_LABEL[d.type]} <span className="font-mono">{d.number}</span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Emitida el {formatDate(d.issuedAt)} · {eurFmt.format(d.total)}
                    {d.correctsNumber && ` · Rectifica ${d.correctsNumber}`}
                    {(d.type === 'PROFORMA' || d.type === 'QUOTATION') && ' · Documento sin validez fiscal'}
                  </div>
                </div>
                <a
                  href={`/api/b2b/orders/${order.id}/documents/${d.id}`}
                  className="btn btn-secondary text-xs py-1.5"
                  download
                >
                  Descargar PDF<span className="sr-only"> {d.number}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
