'use client';

/**
 * B2B customer orders page.
 *
 * URL: /mi-cuenta/b2b/pedidos
 *
 * Lists every wholesale order the current B2B customer has submitted along
 * with its status, totals, and (when accepted) invoice number. Customers
 * can cancel orders that are still PENDING or ACCEPTED — PAID / CANCELLED /
 * REJECTED orders are immutable from the customer side.
 *
 * Non-B2B visitors see a friendly notice pointing them at the B2B login modal.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useB2BSession } from '@/context/B2BSessionContext';

type Status = 'PENDING' | 'ACCEPTED' | 'PAID' | 'CANCELLED' | 'REJECTED';

interface OrderLine {
  productId: string;
  name: string;
  quantity: number;
  unitPriceEur: number;
  lineTotal: number;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: Status;
  subtotal: number;
  ivaAmount: number;
  total: number;
  invoiceNumber: string | null;
  invoicedAt: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  items: OrderLine[];
  notes: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aprobado — pendiente de pago',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rechazado',
};

const STATUS_BADGE: Record<Status, string> = {
  PENDING: 'bg-warning-bg text-warning',
  ACCEPTED: 'bg-premium-gold/15 text-premium-gold',
  PAID: 'bg-success-bg text-success',
  CANCELLED: 'bg-dark-surfaceHover text-text-secondary',
  REJECTED: 'bg-danger-bg text-danger',
};

const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function B2bOrdersPage() {
  const {isB2B, loading: sessionLoading } = useB2BSession();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isB2B) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/b2b/orders', { 
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        setError('No se pudieron cargar los pedidos.');
        return;
      }
      const data = (await res.json()) as { orders: OrderRow[] };
      setOrders(data.orders ?? []);
    } catch {
      setError('No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }, [isB2B]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleCancel = useCallback(
    async (order: OrderRow) => {
      if (!window.confirm(`¿Cancelar el pedido ${order.orderNumber}?`)) return;
      setBusyId(order.id);
      try {
        const res = await fetch(`/api/b2b/orders/${order.id}/cancel`, {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.alert(data.error ?? 'No se pudo cancelar el pedido.');
          return;
        }
        await fetchOrders();
      } finally {
        setBusyId(null);
      }
    },
    [fetchOrders]
  );

  // ── Loading / not-logged-in states ──────────────────────────────────────
  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-dark-bg flex items-center justify-center">
        <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" />
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
          <Link
            href="/"
            className="inline-block btn btn-primary"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-bg py-10">
      <div className="container-custom px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Mis pedidos B2B</h1>
            <p className="text-sm text-text-secondary mt-1">
              Pedidos realizados para tu cuenta mayorista.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/mi-cuenta/b2b/perfil"
              className="btn btn-secondary text-sm py-2"
            >
              Mi perfil
            </Link>
            <Link
              href="/b2b-catalog"
              className="btn btn-primary text-sm py-2"
            >
              Ir al catálogo
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        {loading && orders.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-2xl bg-dark-surface border border-dashed border-dark-border p-10 text-center text-sm text-text-secondary">
            Aún no has realizado ningún pedido. Añade productos al carrito y solicita tu
            primer pedido mayorista.
          </div>
        )}

        <div className="space-y-4">
          {orders.map((o) => {
            const canCancel = o.status === 'PENDING' || o.status === 'ACCEPTED';
            return (
              <article
                key={o.id}
                className="rounded-2xl bg-dark-surface border border-dark-border shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-dark-border">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      Pedido {o.orderNumber}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      Solicitado el {dateFmt.format(new Date(o.createdAt))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    {o.invoiceNumber && (
                      <span className="text-xs text-text-secondary font-mono">
                        Factura {o.invoiceNumber}
                      </span>
                    )}
                    <span className="text-sm font-bold text-premium-gold">
                      {eurFmt.format(o.total)}
                    </span>
                  </div>
                </header>

                <div className="px-5 py-4">
                  <ul className="divide-y divide-dark-border text-sm">
                    {o.items.map((it, idx) => (
                      <li key={`${o.id}-${idx}`} className="flex justify-between py-2">
                        <div className="min-w-0">
                          <div className="font-medium text-text-primary truncate" title={it.name}>
                            {it.name}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {it.quantity} × {eurFmt.format(it.unitPriceEur)}
                          </div>
                        </div>
                        <div className="text-sm font-mono text-text-primary whitespace-nowrap">
                          {eurFmt.format(it.lineTotal)}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 border-t border-dark-border pt-3 flex flex-wrap justify-end gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-text-secondary text-xs">Base imponible</div>
                      <div className="font-mono text-text-primary">{eurFmt.format(o.subtotal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-text-secondary text-xs">IVA 21%</div>
                      <div className="font-mono text-text-primary">{eurFmt.format(o.ivaAmount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-text-secondary text-xs">Total</div>
                      <div className="font-mono font-bold text-premium-gold">{eurFmt.format(o.total)}</div>
                    </div>
                  </div>

                  {o.notes && (
                    <div className="mt-3 p-3 rounded bg-dark-bgSecondary border border-dark-border text-xs text-text-secondary">
                      <strong className="text-text-primary">Notas:</strong> {o.notes}
                    </div>
                  )}
                </div>

                {canCancel && (
                  <footer className="px-5 py-3 border-t border-dark-border flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCancel(o)}
                      disabled={busyId === o.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-dark-borderStrong text-text-secondary hover:bg-dark-surfaceHover disabled:opacity-50"
                    >
                      {busyId === o.id ? 'Cancelando…' : 'Cancelar pedido'}
                    </button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
