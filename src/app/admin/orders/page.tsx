'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { AdminNav } from '@/components/AdminNav';

type OrderStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface OrderItem {
  id?: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number | null;
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
  stripeSessionId: string | null;
  items: OrderItem[];
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
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  COMPLETED: {
    label: 'Completado',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  FAILED: {
    label: 'Fallido',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
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
  }, [page, pageSize]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    if (!data) return;

    const previous = data.orders.find((o) => o.id === orderId)?.status;
    if (!previous || previous === nextStatus) return;

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
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'No se pudo actualizar el estado del pedido.');
      }
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
      <div className="min-h-screen bg-gray-50">
        <div className="container-custom section">
          <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
            <div>
              <h1 className="text-h2">Pedidos</h1>
              <p className="text-sm text-gray-500 mt-1">
                {total === 0
                  ? 'Sin pedidos'
                  : `Mostrando ${rangeStart}-${rangeEnd} de ${total}`}
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="pageSize" className="text-gray-600 font-medium">
                Pedidos por página:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
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
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        Cargando...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        No hay pedidos.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isOpen = expanded.has(order.id);
                      const statusStyle = STATUS_STYLES[order.status] ?? {
                        label: order.status,
                        className: 'bg-gray-100 text-gray-700 border-gray-200',
                      };
                      return (
                        <Fragment key={order.id}>
                          <tr
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleExpanded(order.id)}
                          >
                            <td className="px-4 py-3 text-gray-400">
                              <span
                                className={`inline-block transition-transform ${
                                  isOpen ? 'rotate-90' : ''
                                }`}
                              >
                                ▶
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                              {order.orderNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {dateFmt.format(new Date(order.createdAt))}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {order.fullName}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex flex-col gap-0.5">
                                <a
                                  href={`mailto:${order.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-red-600 hover:underline truncate max-w-[200px]"
                                >
                                  {order.email}
                                </a>
                                <a
                                  href={`tel:${order.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-gray-700 hover:underline"
                                >
                                  {order.phone}
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                              <div className="truncate">
                                {order.shippingAddress}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
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
                            <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                              {currency.format(order.totalAmount)}
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
                                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                                  aria-label={`Cambiar estado del pedido ${order.orderNumber}`}
                                >
                                  {Object.entries(STATUS_STYLES).map(([value, style]) => (
                                    <option key={value} value={value}>
                                      {style.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-gray-50">
                              <td colSpan={8} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                                      Dirección completa
                                    </h4>
                                    <p className="text-sm text-gray-700 leading-relaxed">
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
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                                      Productos ({order.items?.length ?? 0})
                                    </h4>
                                    <ul className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200">
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
                                            <span className="text-gray-800">
                                              {it.quantity}× {it.name}
                                            </span>
                                            <span className="text-gray-600 whitespace-nowrap">
                                              {currency.format(lineTotal)}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                </div>
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
            <p className="text-sm text-gray-600">
              Página {data?.page ?? 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
