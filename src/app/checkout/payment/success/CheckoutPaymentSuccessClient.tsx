'use client';

import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { trackCheckoutCompleted, trackCheckoutFailed } from '@/lib/analytics/events';

interface OrderData {
  id: string;
  orderNumber: string;
  email: string;
  fullName: string;
  paymentStatus: string;
  totalAmount: number;
  itemsSubtotal: number;
  shippingCost: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    discountPercentage?: number;
  }>;
  shipping?: {
    address: string;
    postalCode: string;
    city: string;
    locality: string;
    province: string;
  };
}

interface Props {
  orderNumber: string | null;
}

export default function CheckoutPaymentSuccessClient({ orderNumber }: Props) {
  const { clearCart } = useCart();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!orderNumber) {
      setError('No order number provided');
      setLoading(false);
      return;
    }

    let pollingAttempts = 0;
    const maxPollingAttempts = 6; // Poll for up to 30 seconds

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/get-by-order-number?orderNumber=${orderNumber}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Order not found');
          }
          throw new Error('Failed to fetch order');
        }

        const data = (await response.json()) as OrderData;
        setOrderData(data);

        // Check payment status
        if (data.paymentStatus === 'PAID') {
          setPolling(false);
          
          // Clear cart after successful payment
          clearCart();

          trackCheckoutCompleted({
            orderId: data.orderNumber,
            amount: data.totalAmount,
            paymentMethod: 'redsys',
          });
        } else if (data.paymentStatus === 'PENDING_PAYMENT' && pollingAttempts < maxPollingAttempts) {
          // Still pending, poll again in 5 seconds
          pollingAttempts++;
          setPolling(true);
          setTimeout(fetchOrder, 5000);
        } else if (data.paymentStatus === 'PAYMENT_FAILED') {
          setPolling(false);

          trackCheckoutFailed({
            orderId: data.orderNumber,
            paymentMethod: 'redsys',
            reason: 'Payment declined',
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load order';
        setError(errorMessage);
        setPolling(false);

        trackCheckoutFailed({
          orderId: orderNumber,
          paymentMethod: 'redsys',
          reason: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber]);

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg py-16">
        <div className="container-custom px-4 max-w-3xl">
          {loading ? (
            <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12 text-center">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold mb-4"></div>
              </div>
              <p className="text-text-secondary text-lg">Cargando información del pedido...</p>
            </div>
          ) : error ? (
            <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-text-primary mb-2">Error</h1>
                  <p className="text-text-secondary mb-6">{error}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/checkout"
                  className="btn btn-primary w-full py-3 px-4 text-center"
                >
                  Volver al Checkout
                </Link>
                <Link
                  href="/"
                  className="btn btn-secondary w-full py-3 px-4 text-center"
                >
                  Volver a la Tienda
                </Link>
              </div>
            </div>
          ) : orderData ? (
            <>
              {/* Success Header */}
              {orderData.paymentStatus === 'PAID' ? (
                <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12 mb-8">
                  <div className="flex items-start mb-6">
                    <div className="flex-shrink-0">
                      <svg className="h-12 w-12 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h1 className="text-3xl font-bold text-text-primary mb-2">
                        ¡Pago Confirmado!
                      </h1>
                      <p className="text-text-secondary text-lg">
                        Tu pedido ha sido recibido y pagado correctamente.
                      </p>
                    </div>
                  </div>

                  <div className="bg-dark-bgSecondary border border-dark-border rounded-lg p-4 mb-6">
                    <p className="text-text-secondary mb-2">Número de Pedido:</p>
                    <p className="text-2xl font-bold text-premium-gold">{orderData.orderNumber}</p>
                  </div>

                  <p className="text-text-secondary">
                    Se ha enviado un correo de confirmación a <span className="font-semibold text-text-primary">{orderData.email}</span>.
                    Si tienes preguntas, contacta con <a href="mailto:sales@tcgiberia.com" className="text-premium-gold hover:text-premium-gold_dark">sales@tcgiberia.com</a>.
                  </p>
                </div>
              ) : orderData.paymentStatus === 'PAYMENT_FAILED' ? (
                <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12 mb-8">
                  <div className="flex items-start mb-6">
                    <div className="flex-shrink-0">
                      <svg className="h-12 w-12 text-danger" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h1 className="text-3xl font-bold text-text-primary mb-2">
                        Pago No Confirmado
                      </h1>
                      <p className="text-text-secondary text-lg">
                        El pago no ha sido completado. Por favor, intenta de nuevo.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Link
                      href="/checkout"
                      className="btn btn-primary w-full py-3 px-4 text-center"
                    >
                      Intentar de Nuevo
                    </Link>
                    <Link
                      href="/"
                      className="btn btn-secondary w-full py-3 px-4 text-center"
                    >
                      Volver a la Tienda
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12 mb-8">
                  <div className="flex items-start mb-6">
                    <div className="inline-block">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-premium-gold"></div>
                    </div>
                    <div className="ml-4">
                      <h1 className="text-2xl font-bold text-text-primary mb-2">
                        Confirmando Pago
                      </h1>
                      <p className="text-text-secondary">
                        Tu pago está siendo procesado. Esta página se actualizará automáticamente en unos momentos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Details */}
              {orderData.paymentStatus === 'PAID' && (
                <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-8">
                  <h2 className="text-xl font-bold text-text-primary mb-6">
                    Detalles del Pedido
                  </h2>

                  <div className="space-y-4 mb-6">
                    {orderData.items.map((item, idx) => {
                      const discount = item.discountPercentage || 0;
                      const actualPrice = item.price * (1 - discount / 100);
                      const lineTotal = actualPrice * item.quantity;
                      return (
                        <div key={idx} className="flex justify-between items-center pb-4 border-b border-dark-border last:border-0">
                          <div>
                            <p className="font-semibold text-text-primary">{item.name}</p>
                            <p className="text-sm text-text-secondary">Cantidad: {item.quantity}</p>
                            {discount > 0 && (
                              <p className="text-xs text-premium-gold font-medium mt-1">
                                -{discount}% de descuento • {actualPrice.toFixed(2)}€/unidad
                              </p>
                            )}
                          </div>
                          <p className="font-semibold text-text-primary">
                            {lineTotal.toFixed(2)}€
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-dark-border pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Subtotal:</span>
                      <span className="text-text-primary font-semibold">
                        {orderData.itemsSubtotal.toFixed(2)}€
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Gastos de Envío:</span>
                      <span className="text-text-primary font-semibold">
                        {orderData.shippingCost === 0 ? 'Gratis' : `${orderData.shippingCost.toFixed(2)}€`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-dark-border/50">
                      <span className="text-lg font-bold text-text-primary">Total:</span>
                      <span className="text-2xl font-bold text-premium-gold">
                        {orderData.totalAmount.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {orderData.paymentStatus === 'PAID' && (
                <div className="mt-8 bg-success-bg border border-success/30 rounded-lg p-6">
                  <h3 className="font-bold text-success mb-3">Próximos Pasos</h3>
                  <ul className="text-sm text-text-secondary space-y-2">
                    <li>✓ Tu pedido ha sido confirmado y pagado</li>
                    <li>✓ Recibirás un correo de confirmación en breve</li>
                    <li>✓ TCG Iberia preparará tu pedido para envío</li>
                    <li>✓ Te notificaremos cuando tu pedido esté en camino</li>
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
      <Footer />
    </>
  );
}
