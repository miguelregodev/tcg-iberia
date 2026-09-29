'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { trackStockAlertRemoved } from '@/lib/analytics/events';

interface StockAlert {
  id: string;
  email: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number;
    discountPercentage: number | null;
    stock: number;
    visible: boolean;
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function emailDomain(email: string): string | undefined {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : undefined;
}

export default function AlertasStockPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/user/stock-alerts');
        if (!res.ok) throw new Error('No se pudieron cargar las alertas de stock.');
        const json = await res.json();
        setAlerts(json.data ?? []);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { module: 'mi-cuenta', section: 'alertas-stock' },
        });
        setError('No se pudieron cargar tus alertas de stock.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRemove = async (alert: StockAlert) => {
    setRemovingId(alert.id);
    try {
      const res = await fetch(`/api/user/stock-alerts?id=${encodeURIComponent(alert.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'No se pudo eliminar la alerta.');
      }

      setAlerts((prev) => prev.filter((it) => it.id !== alert.id));
      trackStockAlertRemoved({
        productId: alert.product.id,
        productName: alert.product.name,
        price: Number(alert.product.price),
        emailDomain: emailDomain(alert.email),
      });
      showToast('Alerta eliminada correctamente.');
    } catch (err) {
      Sentry.captureException(err, {
        tags: { module: 'mi-cuenta', action: 'remove-stock-alert' },
        extra: { alertId: alert.id },
      });
      showToast(err instanceof Error ? err.message : 'No se pudo eliminar la alerta.');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-dark-surfaceHover rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card relative">
      <h1 className="text-h3 mb-6">Alertas de Stock</h1>

      {error && (
        <div className="mb-5 px-4 py-3 bg-danger-bg border border-danger/30 text-danger rounded-lg text-sm">
          {error}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-text-primary font-semibold mb-1">No tienes alertas activas.</p>
          <p className="text-sm text-text-secondary mb-6">Cuando un producto esté agotado, podrás activar una alerta desde su ficha.</p>
          <Link href="/booster-boxes" className="btn btn-primary inline-flex">Explorar productos</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className="border border-dark-border rounded-xl p-4 flex items-center gap-4">
              {alert.product.imageUrl ? (
                <img
                  src={alert.product.imageUrl}
                  alt={alert.product.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-dark-bgSecondary flex items-center justify-center text-text-muted flex-shrink-0">📦</div>
              )}

              <div className="flex-1 min-w-0">
                <Link href={`/product/${alert.product.slug}`} className="font-semibold text-text-primary hover:text-premium-gold transition-colors line-clamp-1">
                  {alert.product.name}
                </Link>
                <p className="text-xs text-text-secondary mt-1">Creada el {formatDate(alert.createdAt)}</p>
                <p className="text-sm mt-1">
                  {alert.product.stock > 0 ? (
                    <span className="text-success font-medium">Ya hay stock disponible</span>
                  ) : (
                    <span className="text-warning font-medium">Agotado</span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(alert)}
                disabled={removingId === alert.id}
                className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-premium-gold hover:bg-dark-surfaceHover rounded-lg transition-colors disabled:opacity-50"
              >
                {removingId === alert.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="absolute bottom-4 right-4 px-3 py-2 bg-dark-surface border border-dark-border text-text-primary text-xs rounded-lg shadow-elevated animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}
