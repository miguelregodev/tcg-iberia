'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ORDER_ITEM_VARIANT_LABEL, getOrderItemVariant } from '@/lib/orders/items';
import * as Sentry from '@sentry/nextjs';

type OrderStatus = 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type PaymentStatus = 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED';
type ShippingMode = 'IMMEDIATE' | 'GROUPED';

interface OrderItem {
  id?: string;
  productId: string;
  name: string;
  /** Current product slug, or null when the product no longer exists / is hidden. */
  slug?: string | null;
  quantity: number;
  price: number;
  discountPercentage?: number;
  releaseDate?: string | null;
  isPreorder?: boolean;
}

interface ShipmentSummary {
  shipmentNumber: string;
  shippingCost: number;
  paymentStatus: PaymentStatus;
}

interface Order {
  id: string;
  orderNumber: string;
  fullName: string;
  email: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: OrderItem[];
  shippingMode: ShippingMode;
  shipmentId: string | null;
  shipment: ShipmentSummary | null;
}

interface EligibleOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  createdAt: string;
}

interface ExpandedOrder {
  [key: string]: boolean;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PROCESSING: 'En proceso',
  SHIPPED: 'Enviado',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  PROCESSING: 'bg-warning-bg text-warning',
  SHIPPED: 'bg-blue-950/40 text-blue-300',
  COMPLETED: 'bg-success-bg text-success',
  FAILED: 'bg-danger-bg text-danger',
  CANCELLED: 'bg-dark-surfaceHover text-text-secondary',
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING_PAYMENT: 'Pago pendiente',
  PAID: 'Pagado',
  PAYMENT_FAILED: 'Pago fallido',
  CANCELLED: 'Cancelado',
};

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  PENDING_PAYMENT: 'bg-warning-bg text-warning',
  PAID: 'bg-success-bg text-success',
  PAYMENT_FAILED: 'bg-danger-bg text-danger',
  CANCELLED: 'bg-dark-surfaceHover text-text-secondary',
};

/** Human-readable shipping state for "Agrupar Envío" orders, layered on top of the
 * existing fulfillment status badge rather than replacing it. */
function getGroupedShippingLabel(order: Order): { label: string; className: string } | null {
  if (order.shippingMode !== 'GROUPED') return null;
  if (order.status === 'SHIPPED' || order.status === 'COMPLETED') return null; // fulfillment badge already says it all

  if (!order.shipmentId) {
    return { label: 'Envío agrupado', className: 'bg-premium-gold/15 text-premium-gold' };
  }
  if (order.shipment?.paymentStatus === 'PENDING_PAYMENT') {
    return { label: 'Envío solicitado (pago pendiente)', className: 'bg-warning-bg text-warning' };
  }
  return { label: 'Envío solicitado', className: 'bg-success-bg text-success' };
}

function canRequestShipment(order: Order): boolean {
  return (
    order.shippingMode === 'GROUPED' &&
    order.shipmentId === null &&
    order.paymentStatus === 'PAID' &&
    order.status === 'PROCESSING'
  );
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<ExpandedOrder>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // "Solicitar envío" consolidation panel state
  const [panelOrderId, setPanelOrderId] = useState<string | null>(null);
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shippingWarning, setShippingWarning] = useState<{
    shippingCost: number;
    merchandiseTotal: number;
    freeShippingThreshold: number;
  } | null>(null);

  const toggleExpanded = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/user/orders?page=${page}`);
      if (!res.ok) throw new Error('Failed to load orders');
      const json = await res.json();
      setOrders(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotalOrders(json.pagination?.total ?? 0);
      // The server clamps out-of-range pages (e.g. after orders were removed).
      if (json.pagination?.page && json.pagination.page !== page) setPage(json.pagination.page);
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos' } });
      setError('No se pudieron cargar tus pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setLoading(true);
    setExpandedOrders({});
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openRequestPanel = async (orderId: string) => {
    setPanelOrderId(orderId);
    setPanelError(null);
    setPanelLoading(true);
    setSelectedIds(new Set([orderId]));
    try {
      const res = await fetch('/api/user/shipments/eligible-orders');
      if (!res.ok) throw new Error('No se pudieron cargar los pedidos elegibles.');
      const json = await res.json();
      const list = (json.data ?? []) as EligibleOrder[];
      setEligibleOrders(list);
      // Only orders sharing the same address as the clicked order can actually be combined.
      const reference = list.find((o) => o.id === orderId);
      if (reference) {
        const combinable = list.filter(
          (o) =>
            o.shippingPostalCode === reference.shippingPostalCode &&
            o.shippingAddress.trim().toLowerCase() === reference.shippingAddress.trim().toLowerCase()
        );
        setSelectedIds(new Set(combinable.map((o) => o.id)));
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos_solicitar_envio' } });
      setPanelError('No se pudieron cargar los pedidos elegibles para agrupar.');
    } finally {
      setPanelLoading(false);
    }
  };

  const closePanel = () => {
    setPanelOrderId(null);
    setEligibleOrders([]);
    setSelectedIds(new Set());
    setPanelError(null);
    setShippingWarning(null);
  };

  const toggleSelected = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const confirmShipmentRequest = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setPanelError(null);
    try {
      // Preview first: if a shipping fee applies, ask the customer to acknowledge it.
      const previewRes = await fetch('/api/user/shipments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedIds), preview: true }),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) throw new Error(preview.error || 'No se pudo calcular el coste de envío.');

      if (preview.shippingCost > 0) {
        setShippingWarning({
          shippingCost: preview.shippingCost,
          merchandiseTotal: preview.merchandiseTotal,
          freeShippingThreshold: preview.freeShippingThreshold,
        });
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo calcular el coste de envío.';
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos_preview_envio' } });
      setPanelError(message);
      return;
    } finally {
      setSubmitting(false);
    }

    await requestShipment();
  };

  const requestShipment = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setPanelError(null);
    try {
      const res = await fetch('/api/user/shipments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo solicitar el envío.');

      if (json.requiresPayment) {
        // Redirect to Redsys for the single consolidated shipping fee, same mechanism as checkout.
        submitRedsysForm(json);
        return;
      }

      setShippingWarning(null);
      closePanel();
      await fetchOrders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo solicitar el envío.';
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos_confirmar_envio' } });
      setShippingWarning(null);
      setPanelError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTotal = eligibleOrders
    .filter((o) => selectedIds.has(o.id))
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const submitRedsysForm = (json: { url: string; Ds_SignatureVersion: string; Ds_MerchantParameters: string; Ds_Signature: string }) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = json.url;
    const addInput = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    addInput('Ds_SignatureVersion', json.Ds_SignatureVersion);
    addInput('Ds_MerchantParameters', json.Ds_MerchantParameters);
    addInput('Ds_Signature', json.Ds_Signature);
    document.body.appendChild(form);
    form.submit();
  };

  const [retryingShipmentId, setRetryingShipmentId] = useState<string | null>(null);
  const [cancellingShipmentId, setCancellingShipmentId] = useState<string | null>(null);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

  const retryOrderPayment = async (orderId: string) => {
    setRetryingOrderId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/user/orders/${orderId}/retry-payment`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo reintentar el pago del pedido.');
      submitRedsysForm(json);
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos_reintentar_pago' } });
      setError(err instanceof Error ? err.message : 'No se pudo reintentar el pago del pedido.');
      setRetryingOrderId(null);
    }
  };

  const retryShipmentPayment = async (shipmentId: string) => {
    setRetryingShipmentId(shipmentId);
    setError(null);
    try {
      const res = await fetch(`/api/user/shipments/${shipmentId}/retry-payment`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo reintentar el pago del envío.');
      submitRedsysForm(json);
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos_reintentar_pago_envio' } });
      setError(err instanceof Error ? err.message : 'No se pudo reintentar el pago del envío.');
      setRetryingShipmentId(null);
    }
  };

  const cancelShipmentRequest = async (shipmentId: string) => {
    setCancellingShipmentId(shipmentId);
    setError(null);
    try {
      const res = await fetch(`/api/user/shipments/${shipmentId}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cancelar la solicitud de envío.');
      await fetchOrders();
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos_cancelar_envio' } });
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la solicitud de envío.');
    } finally {
      setCancellingShipmentId(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-dark-surfaceHover rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-h3 mb-6">Historial de Pedidos</h1>

      {error && (
        <div className="mb-5 px-4 py-3 bg-danger-bg border border-danger/30 text-danger rounded-lg text-sm">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-text-secondary">Todavía no tienes pedidos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const groupedLabel = getGroupedShippingLabel(order);
            return (
            <div
              key={order.id}
              className="border border-dark-border rounded-xl overflow-hidden"
            >
              {/* Order Header - Clickable */}
              <button
                onClick={() => toggleExpanded(order.id)}
                className="w-full text-left p-5 hover:bg-dark-surfaceHover transition-colors flex flex-wrap items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm text-text-primary">
                    Pedido #{order.orderNumber}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[order.status]}`}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                    {order.status !== 'CANCELLED' && (
                      <>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${PAYMENT_STATUS_STYLE[order.paymentStatus]}`}
                        >
                          {PAYMENT_STATUS_LABEL[order.paymentStatus]}
                        </span>
                        {groupedLabel && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${groupedLabel.className}`}>
                            {groupedLabel.label}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-sm font-bold text-premium-gold">
                    {order.totalAmount.toFixed(2)} €
                  </span>
                  <svg
                    className={`w-5 h-5 text-text-muted transition-transform ${
                      expandedOrders[order.id] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </button>

              {/* Order Items - Expandable */}
              {expandedOrders[order.id] && (
                <div className="border-t border-dark-border bg-dark-bgSecondary p-5">
                  {order.paymentStatus === 'PENDING_PAYMENT' && order.status !== 'CANCELLED' && (
                    <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg p-3 text-xs text-text-secondary">
                      <p className="font-semibold text-warning mb-1">Pago pendiente</p>
                      <p>Completa el pago para confirmar este pedido.</p>
                      <button
                        onClick={() => retryOrderPayment(order.id)}
                        disabled={retryingOrderId === order.id}
                        className="btn btn-primary mt-3 text-xs py-2 px-4 disabled:opacity-50"
                      >
                        {retryingOrderId === order.id ? 'Procesando...' : 'Pagar ahora'}
                      </button>
                    </div>
                  )}
                  {order.shippingMode === 'GROUPED' && order.status !== 'CANCELLED' && (
                    <div className="mb-4 rounded-lg border border-premium-gold/30 bg-premium-gold/10 p-3 text-xs text-text-secondary">
                      <p className="font-semibold text-premium-gold mb-1">Envío: {groupedLabel?.label ?? 'Agrupado'}</p>
                      {!order.shipmentId ? (
                        <>
                          <p>Has elegido agrupar este pedido con futuras compras.</p>
                          {canRequestShipment(order) && (
                            <button
                              onClick={() => openRequestPanel(order.id)}
                              className="btn btn-primary mt-3 text-xs py-2 px-4"
                            >
                              Solicitar envío
                            </button>
                          )}
                        </>
                      ) : order.shipment?.paymentStatus === 'PENDING_PAYMENT' ? (
                        <>
                          <p>
                            Envío solicitado — quedamos a la espera de confirmar el pago del gasto de envío
                            (pedido de envío #{order.shipment.shipmentNumber}).
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => retryShipmentPayment(order.shipmentId as string)}
                              disabled={retryingShipmentId === order.shipmentId || cancellingShipmentId === order.shipmentId}
                              className="btn btn-secondary mt-3 text-xs py-2 px-4 disabled:opacity-50"
                            >
                              {retryingShipmentId === order.shipmentId ? 'Procesando...' : 'Reintentar pago de envío'}
                            </button>
                            <button
                              onClick={() => cancelShipmentRequest(order.shipmentId as string)}
                              disabled={retryingShipmentId === order.shipmentId || cancellingShipmentId === order.shipmentId}
                              aria-label="Cancelar solicitud de envío"
                              className="btn btn-ghost mt-3 text-xs py-2 px-4 border border-dark-borderStrong disabled:opacity-50"
                            >
                              {cancellingShipmentId === order.shipmentId ? 'Cancelando...' : 'Cancelar'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p>
                          Envío solicitado y listo para preparar (pedido de envío #{order.shipment?.shipmentNumber}).
                        </p>
                      )}
                    </div>
                  )}

                  <h3 className="text-sm font-semibold text-text-primary mb-4">Artículos del pedido</h3>
                  <div className="space-y-3">
                    {Array.isArray(order.items) && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm bg-dark-surface p-3 rounded-lg">
                          <div className="flex-1">
                            {item.slug ? (
                              <Link
                                href={`/product/${item.slug}`}
                                className="font-medium text-text-primary hover:text-premium-gold underline-offset-2 hover:underline transition-colors"
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <p className="font-medium text-text-primary">{item.name}</p>
                            )}
                            <p className="text-xs font-semibold text-premium-gold mt-1">
                              {ORDER_ITEM_VARIANT_LABEL[getOrderItemVariant(item)]}
                            </p>
                            {item.isPreorder ? (
                              <p className="text-xs font-semibold text-premium-gold mt-1">
                                Reserva
                              </p>
                            ) : null}
                            {item.isPreorder && item.releaseDate ? (
                              <p className="text-xs text-text-secondary mt-1">
                                Lanzamiento: {new Date(item.releaseDate).toLocaleDateString('es-ES')}
                              </p>
                            ) : null}
                            <p className="text-xs text-text-secondary mt-1">
                              Cantidad: <span className="font-semibold">{item.quantity}</span>
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-text-primary">
                              {(item.price * item.quantity).toFixed(2)} €
                            </p>
                            <p className="text-xs text-text-secondary">
                              {item.price.toFixed(2)} € c/u
                            </p>
                            {(item.discountPercentage ?? 0) > 0 && (
                              <p className="text-xs text-premium-gold font-medium mt-1">
                                -{item.discountPercentage}%
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-text-secondary">Sin artículos</p>
                    )}
                  </div>

                  {/* Shipping + Total summary */}
                  {Array.isArray(order.items) && order.items.length > 0 && (() => {
                    const itemsSubtotal = order.items.reduce((sum, item) => {
                      const discounted = item.price * (1 - (item.discountPercentage ?? 0) / 100);
                      return sum + discounted * item.quantity;
                    }, 0);
                    const shippingCost = order.shippingMode === 'GROUPED'
                      ? 0
                      : Math.round((order.totalAmount - itemsSubtotal) * 100) / 100;
                    return (
                      <div className="mt-4 pt-4 border-t border-dark-border space-y-2 text-sm">
                        <div className="flex justify-between text-text-secondary">
                          <span>Subtotal</span>
                          <span>{itemsSubtotal.toFixed(2)} €</span>
                        </div>
                        {order.status !== 'CANCELLED' && (
                          <div className="flex justify-between text-text-secondary">
                            <span>Envío</span>
                            <span>
                              {order.shippingMode === 'GROUPED'
                                ? order.shipmentId
                                  ? 'Solicitado'
                                  : 'Pendiente de solicitar'
                                : shippingCost <= 0
                                ? 'Gratis'
                                : `${shippingCost.toFixed(2)} €`}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-text-primary pt-1 border-t border-dark-border">
                          <span>Total</span>
                          <span>{order.totalAmount.toFixed(2)} €</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginación de pedidos" className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 border border-dark-border rounded-lg text-text-secondary bg-dark-surface hover:bg-dark-surfaceHover font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <p className="text-sm text-text-secondary" aria-live="polite">
            Página {page} de {totalPages} ({totalOrders} pedidos)
          </p>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-dark-border rounded-lg text-text-secondary bg-dark-surface hover:bg-dark-surfaceHover font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </nav>
      )}

      {/* "Solicitar envío" / consolidation panel */}
      {panelOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface border border-dark-border rounded-xl shadow-elevated max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-text-primary mb-2">Agrupar pedidos</h2>
            <p className="text-sm text-text-secondary mb-4">
              Puedes enviar juntos los siguientes pedidos elegibles con la misma dirección de envío:
            </p>

            {panelError && (
              <div className="mb-4 px-4 py-3 bg-danger-bg border border-danger/30 text-danger rounded-lg text-sm">
                {panelError}
              </div>
            )}

            {panelLoading ? (
              <div className="animate-pulse space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 bg-dark-surfaceHover rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {eligibleOrders.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-center justify-between gap-3 p-3 border border-dark-border rounded-lg cursor-pointer hover:bg-dark-surfaceHover"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelected(o.id)}
                        className="h-4 w-4 accent-[#F5E77A]"
                      />
                      <span className="text-sm text-text-primary">Pedido #{o.orderNumber}</span>
                    </span>
                    <span className="text-sm font-semibold text-text-primary">{o.totalAmount.toFixed(2)} €</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between text-sm font-semibold text-text-primary border-t border-dark-border pt-3 mb-4">
              <span>Total productos seleccionados</span>
              <span>{selectedTotal.toFixed(2)} €</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closePanel}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-dark-border rounded-lg text-text-secondary bg-dark-surface hover:bg-dark-surfaceHover font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmShipmentRequest}
                disabled={submitting || selectedIds.size === 0}
                className="flex-1 btn btn-primary disabled:opacity-50"
              >
                {submitting ? 'Procesando...' : 'Confirmar envío agrupado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping fee warning */}
      {shippingWarning && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="shipping-warning-title"
          aria-describedby="shipping-warning-desc"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !submitting) setShippingWarning(null);
          }}
        >
          <div className="bg-dark-surface border border-dark-border rounded-xl shadow-elevated max-w-md w-full p-6">
            <h2 id="shipping-warning-title" className="text-lg font-bold text-text-primary mb-2">
              Se aplicarán gastos de envío
            </h2>
            <p id="shipping-warning-desc" className="text-sm text-text-secondary mb-4">
              {shippingWarning.merchandiseTotal < shippingWarning.freeShippingThreshold
                ? `El importe de tus pedidos (${shippingWarning.merchandiseTotal.toFixed(2)} €) no alcanza el mínimo de envío gratuito (${shippingWarning.freeShippingThreshold.toFixed(2)} €), por lo que deberás pagar los gastos de envío para continuar.`
                : 'Para tu dirección de envío se aplican gastos de envío que deberás pagar para continuar.'}
            </p>
            <div className="flex justify-between text-sm font-semibold text-text-primary border-t border-dark-border pt-3 mb-5">
              <span>Gastos de envío</span>
              <span>{shippingWarning.shippingCost.toFixed(2)} €</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setShippingWarning(null)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-dark-border rounded-lg text-text-secondary bg-dark-surface hover:bg-dark-surfaceHover font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={requestShipment}
                disabled={submitting}
                className="flex-1 btn btn-primary disabled:opacity-50"
              >
                {submitting ? 'Redirigiendo...' : 'Confirmar y pagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
