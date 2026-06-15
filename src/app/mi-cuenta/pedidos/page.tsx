'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

type OrderStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number;
  releaseDate?: string | null;
  isPreorder?: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  fullName: string;
  email: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
}

interface ExpandedOrder {
  [key: string]: boolean;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PROCESSING: 'En proceso',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<ExpandedOrder>({});

  const toggleExpanded = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/user/orders');
        if (!res.ok) throw new Error('Failed to load orders');
        const json = await res.json();
        setOrders(json.data ?? []);
      } catch (err) {
        Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'pedidos' } });
        setError('No se pudieron cargar tus pedidos.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-h3 mb-6">Historial de Pedidos</h1>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-gray-500">Todavía no tienes pedidos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* Order Header - Clickable */}
              <button
                onClick={() => toggleExpanded(order.id)}
                className="w-full text-left p-5 hover:bg-gray-50 transition-colors flex flex-wrap items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">
                    Pedido #{order.orderNumber}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {order.totalAmount.toFixed(2)} €
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
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
                <div className="border-t border-gray-200 bg-gray-50 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Artículos del pedido</h3>
                  <div className="space-y-3">
                    {Array.isArray(order.items) && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm bg-white p-3 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.isPreorder ? (
                              <p className="text-xs font-semibold text-blue-700 mt-1">
                                Reserva
                              </p>
                            ) : null}
                            {item.isPreorder && item.releaseDate ? (
                              <p className="text-xs text-gray-500 mt-1">
                                Lanzamiento: {new Date(item.releaseDate).toLocaleDateString('es-ES')}
                              </p>
                            ) : null}
                            <p className="text-xs text-gray-500 mt-1">
                              Cantidad: <span className="font-semibold">{item.quantity}</span>
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-gray-900">
                              {(item.price * item.quantity).toFixed(2)} €
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.price.toFixed(2)} € c/u
                            </p>
                            {(item.discountPercentage ?? 0) > 0 && (
                              <p className="text-xs text-red-600 font-medium mt-1">
                                -{item.discountPercentage}%
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Sin artículos</p>
                    )}
                  </div>

                  {/* Shipping + Total summary */}
                  {Array.isArray(order.items) && order.items.length > 0 && (() => {
                    const itemsSubtotal = order.items.reduce((sum, item) => {
                      const discounted = item.price * (1 - (item.discountPercentage ?? 0) / 100);
                      return sum + discounted * item.quantity;
                    }, 0);
                    const shippingCost = Math.round((order.totalAmount - itemsSubtotal) * 100) / 100;
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500">
                          <span>Subtotal</span>
                          <span>{itemsSubtotal.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Envío</span>
                          <span>{shippingCost <= 0 ? 'Gratis' : `${shippingCost.toFixed(2)} €`}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
                          <span>Total</span>
                          <span>{order.totalAmount.toFixed(2)} €</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
