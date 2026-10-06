'use client';

import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ShipmentData {
  shipmentNumber: string;
  merchandiseTotal: number;
  shippingCost: number;
  paymentStatus: 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED';
  orderNumbers: string[];
}

interface Props {
  shipmentNumber: string | null;
}

export default function ShipmentPaymentSuccessClient({ shipmentNumber }: Props) {
  const [data, setData] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shipmentNumber) {
      setError('Falta el número de envío.');
      setLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 6;

    const fetchShipment = async () => {
      try {
        const res = await fetch(`/api/user/shipments/get-by-number?number=${shipmentNumber}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Envío no encontrado' : 'Error al consultar el envío');
        }
        const json = await res.json();
        setData(json.data as ShipmentData);

        if (json.data.paymentStatus === 'PENDING_PAYMENT' && attempts < maxAttempts) {
          attempts++;
          setTimeout(fetchShipment, 5000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al consultar el envío');
      } finally {
        setLoading(false);
      }
    };

    fetchShipment();
  }, [shipmentNumber]);

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg py-16">
        <div className="container-custom px-4 max-w-3xl">
          {loading ? (
            <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold mb-4 mx-auto"></div>
              <p className="text-text-secondary text-lg">Confirmando el pago del envío...</p>
            </div>
          ) : error ? (
            <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12 text-center">
              <h1 className="text-2xl font-bold text-text-primary mb-2">Error</h1>
              <p className="text-text-secondary mb-6">{error}</p>
              <Link href="/mi-cuenta/pedidos" className="btn btn-primary py-3 px-4">
                Ir a Mis Pedidos
              </Link>
            </div>
          ) : data ? (
            <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12">
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {data.paymentStatus === 'PAID' ? '¡Envío confirmado!' : 'Procesando el pago del envío...'}
              </h1>
              <p className="text-text-secondary mb-6">
                Envío #{data.shipmentNumber} — Pedidos incluidos: {data.orderNumbers.join(', ')}
              </p>
              <div className="border-t border-dark-border pt-4 space-y-2 text-sm mb-6">
                <div className="flex justify-between text-text-secondary">
                  <span>Total mercancía</span>
                  <span>{data.merchandiseTotal.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-semibold text-text-primary">
                  <span>Gasto de envío</span>
                  <span>{data.shippingCost.toFixed(2)} €</span>
                </div>
              </div>
              <Link href="/mi-cuenta/pedidos" className="btn btn-primary w-full py-3 px-4 text-center">
                Ver Mis Pedidos
              </Link>
            </div>
          ) : null}
        </div>
      </div>
      <Footer />
    </>
  );
}
