'use client';

/**
 * B2B customer orders page.
 *
 * URL: /mi-cuenta/b2b/pedidos            (optional ?pedido=<id> opens an order)
 *
 * Paginated list of every wholesale order of the current B2B customer —
 * including orders created on their behalf by an administrator — with
 * payment status, shipping status, tracking and invoice availability.
 * Opening an order loads its full detail (products, totals, addresses,
 * tracking and downloadable documents). Customers can cancel orders that
 * are still unpaid and not yet in preparation.
 *
 * Non-B2B visitors see a friendly notice pointing them at the B2B login modal.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useB2BSession } from '@/context/B2BSessionContext';
import type { B2bCustomerOrderDetail, B2bCustomerOrderSummary, Paginated } from '@/types';
import {
  FulfillmentBadge,
  LifecycleBadge,
  PaymentBadge,
  carrierLabel,
  eurFmt,
  formatDateTime,
} from '@/components/b2b-orders/B2bOrderUi';
import { B2bCustomerOrderDetailView } from '@/components/b2b-orders/B2bCustomerOrderDetailView';

const PAGE_SIZE = 10;

export default function B2bOrdersPage() {
  const { isB2B, loading: sessionLoading } = useB2BSession();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<B2bCustomerOrderSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, B2bCustomerOrderDetail>>({});
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isB2B) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/orders?page=${page}&pageSize=${PAGE_SIZE}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        setError('No se pudieron cargar los pedidos.');
        return;
      }
      setData((await res.json()) as Paginated<B2bCustomerOrderSummary>);
    } catch {
      setError('No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }, [isB2B, page]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailError(null);
    try {
      const res = await fetch(`/api/b2b/orders/${encodeURIComponent(id)}`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        setDetailError('No se pudo cargar el detalle del pedido.');
        return;
      }
      const { order } = (await res.json()) as { order: B2bCustomerOrderDetail };
      setDetails((prev) => ({ ...prev, [id]: order }));
    } catch {
      setDetailError('No se pudo cargar el detalle del pedido.');
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Deep link from emails: /mi-cuenta/b2b/pedidos?pedido=<id>
  useEffect(() => {
    if (!isB2B) return;
    const id = new URLSearchParams(window.location.search).get('pedido');
    if (id) {
      setOpenId(id);
      void fetchDetail(id);
    }
  }, [isB2B, fetchDetail]);

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    void fetchDetail(id);
  };

  const handleCancel = useCallback(
    async (order: B2bCustomerOrderSummary) => {
      if (!window.confirm(`¿Cancelar el pedido ${order.orderNumber}?`)) return;
      setBusyId(order.id);
      try {
        const res = await fetch(`/api/b2b/orders/${order.id}/cancel`, {
          method: 'POST',
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.alert(body.error ?? 'No se pudo cancelar el pedido.');
          return;
        }
        setDetails((prev) => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
        await fetchOrders();
        if (openId === order.id) void fetchDetail(order.id);
      } finally {
        setBusyId(null);
      }
    },
    [fetchOrders, fetchDetail, openId]
  );

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-dark-bg flex items-center justify-center">
        <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" aria-label="Cargando" />
      </main>
    );
  }

  if (!isB2B) {
    return (
      <main className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-dark-surface border border-dark-border rounded-2xl shadow-elevated p-8">
          <h1 className="text-xl font-bold text-text-primary mb-2">Acceso B2B requerido</h1>
          <p className="text-sm text-text-secondary mb-4">
            Debes iniciar sesión con una cuenta B2B activa para ver tus pedidos mayoristas.
          </p>
          <Link href="/" className="inline-block btn btn-primary">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  const orders = data?.items ?? [];
  const openOrphan = openId && !orders.some((o) => o.id === openId) ? details[openId] : null;

  return (
    <main className="min-h-screen bg-dark-bg py-10">
      <div className="container-custom px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Mis pedidos B2B</h1>
            <p className="text-sm text-text-secondary mt-1">Pedidos realizados para tu cuenta mayorista.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/mi-cuenta/b2b/perfil" className="btn btn-secondary text-sm py-2">
              Mi perfil
            </Link>
            <Link href="/b2b-catalog" className="btn btn-primary text-sm py-2">
              Ir al catálogo
            </Link>
          </div>
        </div>

        <div aria-live="polite">
          {error && (
            <div role="alert" className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}
          {detailError && (
            <div role="alert" className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/30 text-danger text-sm">
              {detailError}
            </div>
          )}
        </div>

        {openOrphan && (
          <article className="mb-4 rounded-2xl bg-dark-surface border border-premium-gold/40 p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Pedido {openOrphan.orderNumber}</h2>
            <B2bCustomerOrderDetailView order={openOrphan} />
          </article>
        )}

        {loading && orders.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" aria-label="Cargando" />
          </div>
        )}

        {!loading && data && orders.length === 0 && (
          <div className="rounded-2xl bg-dark-surface border border-dashed border-dark-border p-10 text-center text-sm text-text-secondary">
            Aún no tienes pedidos. Añade productos al carrito y solicita tu primer pedido mayorista.
          </div>
        )}

        <div className="space-y-4">
          {orders.map((o) => {
            const isOpen = openId === o.id;
            const detail = details[o.id];
            return (
              <article key={o.id} className="rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Pedido {o.orderNumber}</h2>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {formatDateTime(o.createdAt)} · {o.itemCount} producto{o.itemCount === 1 ? '' : 's'} ({o.unitCount} uds.)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.status !== 'ACCEPTED' && <LifecycleBadge status={o.status} />}
                    <PaymentBadge status={o.paymentStatus} />
                    <FulfillmentBadge status={o.fulfillmentStatus} />
                    <span className="text-sm font-bold text-premium-gold">{eurFmt.format(o.total)}</span>
                  </div>
                </header>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 text-xs text-text-secondary">
                  <div className="flex flex-wrap gap-4">
                    <span>
                      Seguimiento:{' '}
                      {o.trackingNumber ? (
                        o.trackingUrl ? (
                          <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-premium-gold hover:underline">
                            {carrierLabel(o.shippingProvider)} · {o.trackingNumber}
                          </a>
                        ) : (
                          <span className="text-text-primary">{carrierLabel(o.shippingProvider)} · {o.trackingNumber}</span>
                        )
                      ) : (
                        'pendiente'
                      )}
                    </span>
                    <span>Factura: {o.hasInvoice ? <span className="text-success">disponible</span> : 'no emitida'}</span>
                  </div>
                  <div className="flex gap-2">
                    {o.canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancel(o)}
                        disabled={busyId === o.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-dark-borderStrong text-text-secondary hover:bg-dark-surfaceHover disabled:opacity-50"
                      >
                        {busyId === o.id ? 'Cancelando…' : 'Cancelar pedido'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(o.id)}
                      aria-expanded={isOpen}
                      aria-controls={`b2b-order-${o.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-premium-gold text-dark-bg hover:bg-premium-gold_dark"
                    >
                      {isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div id={`b2b-order-${o.id}`} className="px-5 py-5 border-t border-dark-border">
                    {detail ? (
                      <B2bCustomerOrderDetailView order={detail} />
                    ) : (
                      <p className="text-sm text-text-secondary">Cargando detalle…</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {data && data.totalPages > 1 && (
          <nav aria-label="Paginación de pedidos" className="mt-6 flex items-center justify-between text-sm text-text-secondary">
            <button
              type="button"
              className="btn btn-secondary text-sm py-2"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Anteriores
            </button>
            <span>
              Página {data.page} de {data.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary text-sm py-2"
              disabled={loading || page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguientes →
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
