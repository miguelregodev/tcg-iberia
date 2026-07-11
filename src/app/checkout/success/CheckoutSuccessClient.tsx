'use client';

import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

import { useEffect, useState } from 'react';
import { trackCheckoutCompleted, trackCheckoutFailed } from '@/lib/analytics/events';

interface Props {
  sessionId: string | null;
}


interface LineItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  image?: string | null;
  releaseDate?: string | null;
  isPreorder?: boolean;
}

interface SessionData {
  sessionId: string;
  status: string;
  totalAmount: number;
  currency: string;
  lineItems: LineItem[];
  customerEmail?: string;
  createdAt: string;
  orderNumber?: string;
}

export default function CheckoutSuccessClient({
  sessionId,
}: Props) {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    const fetchOrderAndSession = async () => {
      let resolvedOrderNumber: string | undefined;

      try {
        const orderResponse = await fetch(`/api/orders/get-by-session-id?session_id=${sessionId}`);
        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          resolvedOrderNumber = orderData.orderNumber;
          setOrderNumber(orderData.orderNumber ?? null);
        }

        const response = await fetch(`/api/checkout/session?sessionId=${sessionId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch session data');
        }

        const data = (await response.json()) as SessionData;
        setSessionData(data);

        if (data.status === 'paid') {
          trackCheckoutCompleted({
            orderId: resolvedOrderNumber,
            amount: data.totalAmount,
            paymentMethod: 'stripe_checkout',
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load order details';
        console.error('Session fetch error:', err);
        trackCheckoutFailed({
          orderId: resolvedOrderNumber,
          paymentMethod: 'stripe_checkout',
          reason: errorMessage,
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderAndSession();
  }, [sessionId]);

return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-16">
        <div className="container-custom px-4 max-w-3xl">
          {/* Success Header */}
          <div className="text-center mb-12">
            {/* Success Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Pedido Confirmado.
            </h1>

            {/* Description */}
            <p className="text-lg text-gray-600">
              Muchas gracias por su compra, su pedido ha sido confirmado. Recibirá un correo electrónico de confirmación con los detalles de su pedido y un número de seguimiento una vez que su pedido haya sido enviado.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              </div>
              <p className="text-gray-600 mt-4">Cargando detalles del pedido...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
              <p className="text-red-700 font-semibold">Error Cargando detalles del Pedido. Contacte sales@tcgiberia.com para más información</p>
              <p className="text-red-600 text-sm mt-2">{error}</p>
            </div>
          )}

          {/* Order Summary */}
          {sessionData && !loading && (
            <>
              {/* Order Number & Date */}
              <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-600 text-sm mb-2">Pedido nº:</p>
                    <p className="text-2xl font-bold text-gray-600 break-all">{orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm mb-2">Fecha del Pedido</p>
                    <p className="text-lg font-semibold text-gray-900">{sessionData.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Items Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Details</h2>

                <div className="space-y-4 mb-6">
                  {sessionData.lineItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex gap-4 items-start border border-gray-200 rounded-lg p-4"
                    >
                      {/* Product Image */}
                      {item.image && (
                        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                      )}

                      {/* Product Details */}
                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">
                          {item.name}
                        </h3>
                        {item.isPreorder ? (
                          <p className="text-xs font-semibold text-blue-700 mb-1">
                            Reserva
                          </p>
                        ) : null}
                        {item.isPreorder && item.releaseDate ? (
                          <p className="text-xs text-gray-500 mb-1">
                            Lanzamiento: {new Date(item.releaseDate).toLocaleDateString('es-ES')}
                          </p>
                        ) : null}
                        <p className="text-sm text-gray-600">
                          {item.price.toFixed(2)}€ × {item.quantity} unit{item.quantity !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Subtotal */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {item.subtotal.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {sessionData.lineItems.some((i) => i.isPreorder) && (
                  <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
                    <p className="font-bold">⚠️ Este pedido incluye productos en preventa.</p>
                    <p>Al realizar la reserva, garantizas tu unidad antes del lanzamiento oficial. Los artículos serán enviados una vez estén disponibles y hayan sido recibidos por TCG Iberia de nuestros distribuidores.</p>
                    <p>Si el pedido contiene productos en stock y productos en preventa, todo el pedido se enviará conjuntamente cuando los artículos en preventa estén disponibles. Las fechas de lanzamiento pueden variar por causas ajenas a TCG Iberia.</p>
                  </div>
                )}

                {/* Order Total */}
                <div className="border-t border-gray-200 pt-6 bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">Importe:</span>
                    <span className="text-base font-bold text-gray-600">
                      {(sessionData.totalAmount / 1.21).toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">IVA:</span>
                    <span className="text-base font-bold text-gray-600">
                      {(sessionData.totalAmount - (sessionData.totalAmount / 1.21)).toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">Envío:</span>
                    <span className="text-base font-bold text-gray-600">
                      Gratis
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-gray-600">
                      {sessionData.totalAmount.toFixed(2)}€
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 mt-2">
                    Estado del Pago: {sessionData.status === 'paid' ? '✓ Paid' : 'Processing'}
                  </p>
                </div>
              </div>

              {/* Support Info */}
              <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-200">
                <p className="text-gray-700 mb-3 font-semibold">
                  ¿Necesita ayuda?
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Si tiene alguna pregunta o inquietud sobre su pedido, no dude en contactarnos. Nuestro equipo de soporte está aquí para ayudarle con cualquier consulta relacionada con su compra.
                </p>
                <div className="space-y-2 flex flex-col">
                  <a
                    href="https://wa.me/34689178762"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 hover:text-red-700 font-semibold text-sm"
                  >
                    💬 Chatea en WhatsApp
                  </a>
                  <a
                    href="mailto:sales@tcgiberia.com"
                    className="text-red-600 hover:text-red-700 font-semibold text-sm"
                  >
                    📧 Envíanos un Correo
                  </a>
                </div>
              </div>

              {/* Continue Shopping Button */}
              <div className="text-center">
                <a
                  href="/"
                  className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                >
                  Continuar Comprando
                </a>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
