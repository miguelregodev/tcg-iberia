'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

interface CartItem {
  name: string;
  quantity: number;
  imageUrl: string | null;
}

interface PendingCart {
  id: string;
  status: 'ACTIVE' | 'ABANDONED' | 'RECOVERED';
  productCount: number;
  totalAmount: number;
  lastActivityAt: string;
  items: CartItem[];
  recoveryUrl: string | null;
}

const STATUS_LABEL: Record<PendingCart['status'], string> = {
  ACTIVE: 'Activo',
  ABANDONED: 'Abandonado',
  RECOVERED: 'Recuperado',
};

const STATUS_STYLE: Record<PendingCart['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  ABANDONED: 'bg-yellow-100 text-yellow-800',
  RECOVERED: 'bg-blue-100 text-blue-800',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CarritosPendientesPage() {
  const [carts, setCarts] = useState<PendingCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/user/pending-carts');
        if (!res.ok) throw new Error('No se pudieron cargar los carritos pendientes.');
        const json = await res.json();
        setCarts(json.data ?? []);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { module: 'mi-cuenta', section: 'carritos-pendientes' },
        });
        setError('No se pudieron cargar tus carritos pendientes.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Carritos pendientes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carritos con artículos que no terminaste de comprar.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && carts.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🛒</p>
          <p className="text-gray-600">No tienes carritos pendientes.</p>
          <Link href="/" className="mt-4 inline-block text-red-600 font-semibold hover:underline">
            Ir a la tienda
          </Link>
        </div>
      )}

      {!loading && carts.length > 0 && (
        <div className="space-y-4">
          {carts.map((cart) => (
            <div key={cart.id} className="card">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[cart.status]}`}
                  >
                    {STATUS_LABEL[cart.status]}
                  </span>
                  <span className="text-sm text-gray-500">{formatDate(cart.lastActivityAt)}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{cart.productCount} artículo{cart.productCount !== 1 ? 's' : ''}</p>
                  <p className="text-lg font-bold text-gray-900">{cart.totalAmount.toFixed(2)}€</p>
                </div>
              </div>

              {/* Items preview */}
              <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
                {cart.items.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="flex-shrink-0 w-16 text-center">
                    {item.imageUrl ? (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 mb-1">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-1 text-gray-400 text-xl">
                        📦
                      </div>
                    )}
                    <p className="text-xs text-gray-600 truncate" title={item.name}>
                      ×{item.quantity}
                    </p>
                  </div>
                ))}
                {cart.items.length > 6 && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 text-xs font-semibold">
                    +{cart.items.length - 6}
                  </div>
                )}
              </div>

              {/* CTA */}
              {cart.recoveryUrl ? (
                <a
                  href={cart.recoveryUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Continuar compra →
                </a>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                >
                  Ir a la tienda
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
