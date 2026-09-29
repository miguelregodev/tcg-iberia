'use client';

import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useEffect } from 'react';
import Link from 'next/link';
import { trackCheckoutFailed } from '@/lib/analytics/events';

interface Props {
  orderNumber: string | null;
  reason: string | null;
}

export default function CheckoutPaymentErrorClient({ orderNumber, reason }: Props) {
  useEffect(() => {
    trackCheckoutFailed({
      orderId: orderNumber || 'unknown',
      paymentMethod: 'redsys',
      reason: reason || 'User returned to error page',
    });
  }, [orderNumber, reason]);

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg py-16">
        <div className="container-custom px-4 max-w-3xl">
          <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12">
            <div className="flex items-start mb-6">
              <div className="flex-shrink-0">
                <svg
                  className="h-12 w-12 text-danger"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h1 className="text-3xl font-bold text-text-primary mb-2">
                  Pago No Completado
                </h1>
                <p className="text-text-secondary text-lg">
                  Lamentablemente, no hemos podido procesar tu pago.
                </p>
              </div>
            </div>

            {reason && (
              <div className="bg-danger-bg border border-danger/30 rounded-lg p-4 mb-6">
                <p className="text-danger text-sm">
                  <span className="font-semibold">Razón:</span> {reason}
                </p>
              </div>
            )}

            <p className="text-text-secondary mb-6">
              Por favor, intenta nuevamente o elige un método de pago diferente. Si el problema persiste, 
              <a href="mailto:sales@tcgiberia.com" className="text-premium-gold hover:text-premium-gold_dark ml-1">
                contacta con nuestro equipo
              </a>.
            </p>

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

            <div className="mt-8 bg-info-bg border border-info/30 rounded-lg p-6">
              <h3 className="font-bold text-info mb-3">Consejos</h3>
              <ul className="text-sm text-text-secondary space-y-2">
                <li>• Verifica que los datos de tu tarjeta sean correctos</li>
                <li>• Asegúrate de que tu tarjeta no ha expirado</li>
                <li>• Comprueba que tu banco no está bloqueando la transacción</li>
                <li>• Intenta usar una tarjeta diferente si tienes disponible</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
