'use client';

import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

interface Props {
  shipmentNumber: string | null;
}

export default function ShipmentPaymentErrorClient({ shipmentNumber }: Props) {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg py-16">
        <div className="container-custom px-4 max-w-3xl">
          <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-12">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Pago de envío no completado</h1>
            <p className="text-text-secondary mb-6">
              No hemos podido confirmar el pago del gasto de envío
              {shipmentNumber ? ` para el envío #${shipmentNumber}` : ''}. Tus pedidos siguen disponibles
              para volver a solicitar el envío desde &ldquo;Mis pedidos&rdquo;.
            </p>
            <div className="space-y-3">
              <Link href="/mi-cuenta/pedidos" className="btn btn-primary w-full py-3 px-4 text-center">
                Volver a Mis Pedidos
              </Link>
              <Link href="/" className="btn btn-secondary w-full py-3 px-4 text-center">
                Volver a la Tienda
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
