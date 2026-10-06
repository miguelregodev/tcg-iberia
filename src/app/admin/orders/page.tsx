'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { AdminNav } from '@/components/AdminNav';
import { getTrackingUrl, getProviderLabel } from '@/lib/shipping/tracking-urls';

type OrderStatus = 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'DEVUELTO';
type PaymentStatus = 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED';
type ShippingProvider = 'CORREOS' | 'MRW' | 'SEUR' | 'CTT_EXPRESS';

interface OrderItem {
  id?: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number | null;
}

interface ShipmentInfo {
  shipmentNumber: string;
  shippingCost: number;
  merchandiseTotal: number;
  paymentStatus: PaymentStatus;
  orders: Array<{ id: string; orderNumber: string; status: OrderStatus }>;
}

interface Order {
  id: string;
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingLocality: string;
  shippingProvince: string;
  totalAmount: number;
  status: OrderStatus;
  shippingProvider: ShippingProvider | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  stripeSessionId: string | null;
  paymentStatus: PaymentStatus;
  paymentProvider: string;
  redsysOrderId: string | null;
  redsysTransactionId: string | null;
  redsysAuthCode: string | null;
  paymentPaidAt: string | null;
  items: OrderItem[];
  shippingMode: 'IMMEDIATE' | 'GROUPED';
  shipmentId: string | null;
  shipment: ShipmentInfo | null;
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

const STATUS_STYLES: Record<OrderStatus, { label: string; className: string }> = {
  PROCESSING: {
    label: 'En proceso',
    className: 'bg-warning-bg text-warning border-warning/30',
  },
  SHIPPED: {
    label: 'Enviado',
    className: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
  },
  COMPLETED: {
    label: 'Entregado',
    className: 'bg-success-bg text-success border-success/30',
  },
  FAILED: {
    label: 'Fallido',
    className: 'bg-danger-bg text-danger border-danger/30',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong',
  },
  DEVUELTO: {
    label: 'Devuelto',
    className: 'bg-purple-950/40 text-purple-300 border-purple-800/40',
  },
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: {
    label: 'Pendiente de pago',
    className: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
  },
  PAID: {
    label: 'Pagado',
    className: 'bg-success-bg text-success border-success/30',
  },
  PAYMENT_FAILED: {
    label: 'Pago fallido',
    className: 'bg-danger-bg text-danger border-danger/30',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong',
  },
};

const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [shippingEditId, setShippingEditId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<PaymentStatus | ''>('');
  const [shippingForm, setShippingForm] = useState<{
    shippingProvider: ShippingProvider | '';
    trackingNumber: string;
  }>({ shippingProvider: '', trackingNumber: '' });

  // Debounce free-text search so we don't hammer the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.set('search', search);
        if (filterStatus) params.set('status', filterStatus);
        if (filterPaymentStatus) params.set('paymentStatus', filterPaymentStatus);
        const res = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to load orders');
        const json = (await res.json()) as OrdersResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, filterStatus, filterPaymentStatus]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (
    orderId: string,
    nextStatus: OrderStatus,
    shippingProvider?: ShippingProvider,
    trackingNumber?: string
  ) => {
    if (!data) return;

    const previous = data.orders.find((o) => o.id === orderId)?.status;
    if (!previous || previous === nextStatus) return;

    // If changing to SHIPPED, require shipping details
    if (nextStatus === 'SHIPPED' && (!shippingProvider || !trackingNumber)) {
      setShippingEditId(orderId);
      return;
    }

    setUpdatingOrderId(orderId);
    setError(null);

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        orders: prev.orders.map((order) =>
          order.id === orderId ? { ...order, status: nextStatus } : order,
        ),
      };
    });

    try {
      const body: any = { orderId, status: nextStatus };
      if (nextStatus === 'SHIPPED') {
        body.shippingProvider = shippingProvider;
        body.trackingNumber = trackingNumber;
      }

      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'No se pudo actualizar el estado del pedido.');
      }

      const updatedJson = (await res.json()) as { order: Order };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orders: prev.orders.map((order) =>
            order.id === orderId ? updatedJson.order : order,
          ),
        };
      });
      setShippingEditId(null);
    } catch (err) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orders: prev.orders.map((order) =>
            order.id === orderId ? { ...order, status: previous } : order,
          ),
        };
      });
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del pedido.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const rangeStart = useMemo(
    () => (total === 0 ? 0 : (page - 1) * pageSize + 1),
    [total, page, pageSize],
  );
  const rangeEnd = useMemo(
    () => Math.min(page * pageSize, total),
    [page, pageSize, total],
  );

  return (
    <>
      <AdminNav />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom section">
          <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
            <div>
              <h1 className="text-h2">Pedidos</h1>
              <p className="text-sm text-text-muted mt-1">
                {total === 0
                  ? 'Sin pedidos'
                  : `Mostrando ${rangeStart}-${rangeEnd} de ${total}`}
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="orderSearch" className="sr-only">
                Buscar por número de pedido
              </label>
              <input
                id="orderSearch"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nº de pedido..."
                aria-label="Buscar por número de pedido"
                className="border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-premium-gold w-56"
              />
              <label htmlFor="filterStatus" className="text-text-secondary font-medium">
                Estado:
              </label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as OrderStatus | '');
                  setPage(1);
                }}
                className="border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_STYLES).map(([value, style]) => (
                  <option key={value} value={value}>
                    {style.label}
                  </option>
                ))}
              </select>
              <label htmlFor="filterPaymentStatus" className="text-text-secondary font-medium">
                Pago:
              </label>
              <select
                id="filterPaymentStatus"
                value={filterPaymentStatus}
                onChange={(e) => {
                  setFilterPaymentStatus(e.target.value as PaymentStatus | '');
                  setPage(1);
                }}
                className="border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
              >
                <option value="">Todos los pagos</option>
                {Object.entries(PAYMENT_STATUS_STYLES).map(([value, style]) => (
                  <option key={value} value={value}>
                    {style.label}
                  </option>
                ))}
              </select>
              <label htmlFor="pageSize" className="text-text-secondary font-medium">
                Por página:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shipping details modal */}
          {shippingEditId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-dark-surface rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
                <h2 className="text-lg font-bold text-text-primary mb-4">Agregar información de envío</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="shippingProvider" className="block text-sm font-medium text-text-secondary mb-2">
                      Transportista
                    </label>
                    <select
                      id="shippingProvider"
                      value={shippingForm.shippingProvider}
                      onChange={(e) =>
                        setShippingForm({ ...shippingForm, shippingProvider: e.target.value as ShippingProvider })
                      }
                      className="w-full border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
                    >
                      <option value="">Seleccionar transportista...</option>
                      <option value="CORREOS">Correos</option>
                      <option value="MRW">MRW</option>
                      <option value="SEUR">SEUR</option>
                      <option value="CTT_EXPRESS">CTT Express</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="trackingNumber" className="block text-sm font-medium text-text-secondary mb-2">
                      Número de seguimiento
                    </label>
                    <input
                      id="trackingNumber"
                      type="text"
                      value={shippingForm.trackingNumber}
                      onChange={(e) =>
                        setShippingForm({ ...shippingForm, trackingNumber: e.target.value })
                      }
                      placeholder="p. ej. 1234567890"
                      className="w-full border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShippingEditId(null);
                      setShippingForm({ shippingProvider: '', trackingNumber: '' });
                    }}
                    className="flex-1 px-4 py-2 border border-dark-border rounded-lg text-text-secondary bg-dark-surface hover:bg-dark-surfaceHover font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (shippingForm.shippingProvider && shippingForm.trackingNumber && shippingEditId) {
                        handleStatusChange(shippingEditId, 'SHIPPED', shippingForm.shippingProvider, shippingForm.trackingNumber);
                        setShippingForm({ shippingProvider: '', trackingNumber: '' });
                      }
                    }}
                    disabled={!shippingForm.shippingProvider || !shippingForm.trackingNumber}
                    className="flex-1 px-4 py-2 bg-premium-gold text-dark-bg rounded-lg hover:bg-premium-gold_dark font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-danger-bg border border-danger/30 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}

          <div className="bg-dark-surface rounded-xl shadow-sm border border-dark-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-dark-bgSecondary text-text-muted uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold w-8"></th>
                    <th className="px-4 py-3 text-left font-semibold">
                      N.º Pedido
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Contacto
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Dirección de envío
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Estado de pago
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-text-muted"
                      >
                        Cargando...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-text-muted"
                      >
                        No hay pedidos.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isOpen = expanded.has(order.id);
                      const statusStyle = STATUS_STYLES[order.status] ?? {
                        label: order.status,
                        className: 'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong',
                      };
                      return (
                        <Fragment key={order.id}>
                          <tr
                            className="hover:bg-dark-surfaceHover cursor-pointer"
                            onClick={() => toggleExpanded(order.id)}
                          >
                            <td className="px-4 py-3 text-text-muted">
                              <span
                                className={`inline-block transition-transform ${
                                  isOpen ? 'rotate-90' : ''
                                }`}
                              >
                                ▶
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                              {order.orderNumber}
                              {order.shippingMode === 'GROUPED' && (
                                <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-premium-gold/15 text-premium-gold align-middle">
                                  {order.shipment
                                    ? order.shipment.paymentStatus === 'PENDING_PAYMENT'
                                      ? 'ENVÍO: PAGO PENDIENTE'
                                      : 'ENVÍO SOLICITADO'
                                    : 'AGRUPADO'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                              {dateFmt.format(new Date(order.createdAt))}
                            </td>
                            <td className="px-4 py-3 font-medium text-text-primary">
                              {order.fullName}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              <div className="flex flex-col gap-0.5">
                                <a
                                  href={`mailto:${order.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-premium-gold hover:underline truncate max-w-[200px]"
                                >
                                  {order.email}
                                </a>
                                <a
                                  href={`tel:${order.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-text-secondary hover:underline"
                                >
                                  {order.phone}
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-secondary max-w-[280px]">
                              <div className="truncate">
                                {order.shippingAddress}
                              </div>
                              <div className="text-xs text-text-muted truncate">
                                {order.shippingPostalCode}{' '}
                                {order.shippingLocality}
                                {order.shippingLocality &&
                                order.shippingCity &&
                                order.shippingLocality !== order.shippingCity
                                  ? `, ${order.shippingCity}`
                                  : ''}
                                {order.shippingProvince
                                  ? ` (${order.shippingProvince})`
                                  : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-text-primary whitespace-nowrap">
                              {currency.format(order.totalAmount)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full border text-xs font-semibold ${
                                  PAYMENT_STATUS_STYLES[order.paymentStatus]
                                    ?.className ??
                                  'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong'
                                }`}
                              >
                                {PAYMENT_STATUS_STYLES[order.paymentStatus]
                                  ?.label ?? order.paymentStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full border text-xs font-semibold ${statusStyle.className}`}
                                >
                                  {statusStyle.label}
                                </span>
                                <select
                                  value={order.status}
                                  disabled={updatingOrderId === order.id}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    handleStatusChange(
                                      order.id,
                                      e.target.value as OrderStatus,
                                    )
                                  }
                                  className="text-xs border border-dark-border rounded-md px-2 py-1 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold disabled:opacity-50"
                                  aria-label={`Cambiar estado del pedido ${order.orderNumber}`}
                                >
                                  {Object.entries(STATUS_STYLES).map(([value, style]) => (
                                    <option key={value} value={value}>
                                      {style.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {order.status === 'SHIPPED' && order.shippingProvider && (
                                <div className="mt-3 p-3 bg-dark-surfaceHover border border-dark-borderStrong rounded-lg text-left">
                                  <p className="text-xs font-semibold text-premium-gold mb-2">Información de envío</p>
                                  <p className="text-xs text-text-secondary">
                                    <strong>Transportista:</strong> {getProviderLabel(order.shippingProvider as ShippingProvider)}
                                  </p>
                                  <p className="text-xs text-text-secondary">
                                    <strong>Número de seguimiento:</strong>{' '}
                                    {getTrackingUrl(order.shippingProvider as ShippingProvider, order.trackingNumber || '') ? (
                                      <a
                                        href={getTrackingUrl(order.shippingProvider as ShippingProvider, order.trackingNumber || '') || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-premium-gold hover:text-premium-gold_dark"
                                      >
                                        {order.trackingNumber}
                                      </a>
                                    ) : (
                                      order.trackingNumber
                                    )}
                                  </p>
                                  {order.shippedAt && (
                                    <p className="text-xs text-text-secondary">
                                      <strong>Enviado:</strong> {new Date(order.shippedAt).toLocaleDateString('es-ES')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-dark-bgSecondary">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">
                                      Dirección completa
                                    </h4>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                      {order.shippingAddress}
                                      <br />
                                      {order.shippingPostalCode}{' '}
                                      {order.shippingLocality}
                                      {order.shippingLocality &&
                                      order.shippingCity &&
                                      order.shippingLocality !==
                                        order.shippingCity
                                        ? `, ${order.shippingCity}`
                                        : ''}
                                      <br />
                                      {order.shippingProvince}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">
                                      Productos ({order.items?.length ?? 0})
                                    </h4>
                                    <ul className="divide-y divide-dark-border bg-dark-surface rounded-lg border border-dark-border">
                                      {(order.items ?? []).map((it, idx) => {
                                        const unit =
                                          it.discountPercentage
                                            ? Number(it.price) *
                                              (1 -
                                                Number(
                                                  it.discountPercentage,
                                                ) /
                                                  100)
                                            : Number(it.price);
                                        const lineTotal = unit * it.quantity;
                                        return (
                                          <li
                                            key={idx}
                                            className="px-3 py-2 flex justify-between gap-3 text-sm"
                                          >
                                            <span className="text-text-primary">
                                              {it.quantity}× {it.name}
                                            </span>
                                            <span className="text-text-secondary whitespace-nowrap">
                                              {currency.format(lineTotal)}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">
                                      Información de pago
                                    </h4>
                                    <div className="space-y-2 bg-dark-surface rounded-lg border border-dark-border p-3">
                                      <div className="text-sm">
                                        <span className="text-text-secondary">Proveedor:</span>
                                        <p className="font-medium text-text-primary">
                                          {order.paymentProvider === 'redsys'
                                            ? 'Redsys'
                                            : order.paymentProvider === 'stripe'
                                              ? 'Stripe'
                                              : order.paymentProvider}
                                        </p>
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-text-secondary">
                                          Estado de pago:
                                        </span>
                                        <p>
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${
                                              PAYMENT_STATUS_STYLES[
                                                order.paymentStatus
                                              ]?.className ??
                                              'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong'
                                            }`}
                                          >
                                            {PAYMENT_STATUS_STYLES[
                                              order.paymentStatus
                                            ]?.label ?? order.paymentStatus}
                                          </span>
                                        </p>
                                      </div>
                                      {order.redsysOrderId && (
                                        <div className="text-sm">
                                          <span className="text-text-secondary">
                                            N.º Redsys:
                                          </span>
                                          <p className="font-mono text-text-primary">
                                            {order.redsysOrderId}
                                          </p>
                                        </div>
                                      )}
                                      {order.redsysTransactionId && (
                                        <div className="text-sm">
                                          <span className="text-text-secondary">
                                            Ref. Transacción:
                                          </span>
                                          <p className="font-mono text-xs text-text-primary break-all">
                                            {order.redsysTransactionId}
                                          </p>
                                        </div>
                                      )}
                                      {order.redsysAuthCode && (
                                        <div className="text-sm">
                                          <span className="text-text-secondary">
                                            Código Auth:
                                          </span>
                                          <p className="font-mono text-text-primary">
                                            {order.redsysAuthCode}
                                          </p>
                                        </div>
                                      )}
                                      {order.paymentPaidAt && (
                                        <div className="text-sm">
                                          <span className="text-text-secondary">
                                            Pagado el:
                                          </span>
                                          <p className="text-text-primary">
                                            {dateFmt.format(
                                              new Date(order.paymentPaidAt),
                                            )}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {order.shippingMode === 'GROUPED' && (
                                  <div className="mt-6 pt-4 border-t border-dark-border">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">
                                      Envío agrupado (&quot;Agrupar Envío&quot;)
                                    </h4>
                                    <div className="bg-dark-surface rounded-lg border border-dark-border p-3 text-sm space-y-2">
                                      {!order.shipment ? (
                                        <p className="text-premium-gold font-semibold">
                                          En espera de agrupación — el cliente aún no ha solicitado el envío.
                                        </p>
                                      ) : (
                                        <>
                                          <p className="font-semibold text-text-primary">
                                            Envío #{order.shipment.shipmentNumber} —{' '}
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${
                                                PAYMENT_STATUS_STYLES[order.shipment.paymentStatus]?.className ??
                                                'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong'
                                              }`}
                                            >
                                              {order.shipment.paymentStatus === 'PENDING_PAYMENT'
                                                ? 'Pago de envío pendiente'
                                                : PAYMENT_STATUS_STYLES[order.shipment.paymentStatus]?.label ??
                                                  order.shipment.paymentStatus}
                                            </span>
                                          </p>
                                          <p className="text-text-secondary">
                                            Mercancía combinada: {currency.format(order.shipment.merchandiseTotal)} · Gasto de envío:{' '}
                                            {currency.format(order.shipment.shippingCost)}
                                          </p>
                                          <div>
                                            <span className="text-text-secondary">Pedidos incluidos:</span>{' '}
                                            {order.shipment.orders.map((o, idx) => (
                                              <span key={o.id} className="font-mono text-text-primary">
                                                #{o.orderNumber}
                                                {idx < order.shipment!.orders.length - 1 ? ', ' : ''}
                                              </span>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <p className="text-sm text-text-secondary">
              Página {data?.page ?? 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface text-text-secondary hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface text-text-secondary hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface text-text-secondary hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface text-text-secondary hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
