'use client';

import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { trackCheckoutCompleted, trackCheckoutFailed } from '@/lib/analytics/events';

interface Props {
  sessionId: string | null;
  partyParticipationId?: string | null;
  redsysMerchantParameters?: string | null;
  redsysSignature?: string | null;
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
  inventoryConflict?: boolean;
}

interface PartyPurchase {
  id: string;
  participationStatus: string;
  confirmed: boolean;
  amountPaid: number;
  orderNumber: string | null;
  party: {
    id: string;
    status: string;
    productName: string;
    language: string;
  };
}

export default function CheckoutSuccessClient({
  sessionId,
  partyParticipationId,
  redsysMerchantParameters,
  redsysSignature,
}: Props) {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [partyPurchase, setPartyPurchase] = useState<PartyPurchase | null>(null);
  const [partyConfirmationError, setPartyConfirmationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (partyParticipationId) {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let attempts = 0;
      const maxAttempts = 10;

      const fetchPartyParticipation = async () => {
        try {
          const response = await fetch(
            `/api/user/parties/checkout-confirmation?participation_id=${encodeURIComponent(partyParticipationId)}`,
          );
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'No se pudo cargar la participación Party.');
          }
          const data = (await response.json()) as { partyPurchase: PartyPurchase | null };
          if (!data.partyPurchase) throw new Error('No se encontró esta participación.');
          if (cancelled) return;
          setPartyPurchase(data.partyPurchase);
          if (
            !data.partyPurchase.confirmed &&
            data.partyPurchase.participationStatus === 'PENDING_PAYMENT' &&
            attempts < maxAttempts
          ) {
            attempts += 1;
            timer = setTimeout(fetchPartyParticipation, 3000);
            return;
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'No se pudo cargar la participación Party.');
          }
        }
        if (!cancelled) setLoading(false);
      };

      const confirmAndFetch = async () => {
        if (redsysMerchantParameters && redsysSignature) {
          try {
            await fetch('/api/user/parties/checkout-confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                participationId: partyParticipationId,
                Ds_MerchantParameters: redsysMerchantParameters,
                Ds_Signature: redsysSignature,
              }),
            });
          } catch {
            // Fall back to polling; the server notification may still confirm it.
          }
        }
        await fetchPartyParticipation();
      };
      void confirmAndFetch();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

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

        try {
          const partyResponse = await fetch(
            `/api/user/parties/checkout-confirmation?session_id=${encodeURIComponent(sessionId)}`,
          );
          if (partyResponse.ok) {
            const partyData = (await partyResponse.json()) as { partyPurchase: PartyPurchase | null };
            setPartyPurchase(partyData.partyPurchase);
          } else if (partyResponse.status !== 401) {
            setPartyConfirmationError('No pudimos cargar los detalles de la participación Party.');
          }
        } catch {
          setPartyConfirmationError('No pudimos cargar los detalles de la participación Party.');
        }

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
  }, [sessionId, partyParticipationId, redsysMerchantParameters, redsysSignature]);

return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg py-16">
        <div className="container-custom px-4 max-w-3xl">
          {/* Success Header */}
          <div className="text-center mb-12">
            {/* Success Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-success-bg rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-success"
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
            <h1 className="text-4xl font-bold text-text-primary mb-4">
              {sessionData?.inventoryConflict
                ? 'Pago reembolsado — stock no disponible'
                : partyPurchase?.confirmed
                ? '¡Tu participación en la Party está confirmada!'
                : partyPurchase
                  ? 'Estamos confirmando tu participación en la Party'
                  : 'Pedido Confirmado.'}
            </h1>

            {/* Description */}
            <p className="text-lg text-text-secondary">
              {sessionData?.inventoryConflict
                ? 'El producto se reservó o agotó antes de confirmar tu compra. Hemos solicitado el reembolso completo al proveedor de pago; el abono aparecerá según los plazos de tu banco.'
                : partyPurchase
                ? partyPurchase.confirmed
                  ? 'Tu plaza ya está confirmada. Consulta el progreso y los detalles actualizados de la apertura en la página de la Party.'
                  : 'El pago está siendo verificado por nuestro sistema. La plaza solo se confirmará cuando recibamos la confirmación segura del pago.'
                : 'Muchas gracias por su compra, su pedido ha sido confirmado. Recibirá un correo electrónico de confirmación con los detalles de su pedido y un número de seguimiento una vez que su pedido haya sido enviado.'}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold"></div>
              </div>
              <p className="text-text-secondary mt-4">Cargando detalles del pedido...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-danger-bg border border-danger/30 rounded-lg p-6 mb-8">
              <p className="text-danger font-semibold">Error Cargando detalles del Pedido. Contacte sales@tcgiberia.com para más información</p>
              <p className="text-danger text-sm mt-2">{error}</p>
            </div>
          )}

          {partyConfirmationError && !loading && (
            <p role="alert" className="mb-6 rounded-lg border border-warning/30 bg-warning-bg p-4 text-warning">
              {partyConfirmationError}
            </p>
          )}

          {/* Order Summary */}
          {(sessionData || partyPurchase) && !loading && (
            <>
              {partyPurchase && (
                <section
                  aria-live="polite"
                  className="bg-dark-surface rounded-xl border border-premium-gold/40 p-6 mb-8"
                >
                  <h2 className="text-xl font-bold text-text-primary">
                    {partyPurchase.confirmed
                      ? '¡Tu participación en la Party está confirmada!'
                      : 'Participación de Party pendiente de confirmación'}
                  </h2>
                  <p className="mt-3 text-text-secondary">
                    {partyPurchase.party.productName} ({partyPurchase.party.language})
                  </p>
                  <p className="mt-1 text-premium-gold font-semibold">
                    {partyPurchase.amountPaid.toFixed(2)} €
                  </p>
                  {partyPurchase.orderNumber && (
                    <p className="mt-2 text-sm text-text-secondary">
                      Referencia del pedido: {partyPurchase.orderNumber}
                    </p>
                  )}
                  <Link
                    href={`/parties/${partyPurchase.party.id}`}
                    className="btn btn-primary inline-flex mt-5"
                  >
                    Ver esta Party
                  </Link>
                </section>
              )}

              {sessionData && (
                <>
              {/* Order Number & Date */}
              <div className="bg-dark-surface rounded-xl border border-dark-border p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-text-secondary text-sm mb-2">Pedido nº:</p>
                    <p className="text-2xl font-bold text-premium-gold break-all">{orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-2">Fecha del Pedido</p>
                    <p className="text-lg font-semibold text-text-primary">{sessionData.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Items Summary */}
              <div className="bg-dark-surface rounded-xl border border-dark-border p-8 mb-8">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Order Details</h2>

                <div className="space-y-4 mb-6">
                  {sessionData.lineItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex gap-4 items-start border border-dark-border rounded-lg p-4"
                    >
                      {/* Product Image */}
                      {item.image && (
                        <div className="flex-shrink-0 w-20 h-20 bg-dark-bgSecondary rounded-lg overflow-hidden">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                      )}

                      {/* Product Details */}
                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-text-primary mb-1 line-clamp-2">
                          {item.name}
                        </h3>
                        {item.isPreorder ? (
                          <p className="text-xs font-semibold text-premium-gold mb-1">
                            Reserva
                          </p>
                        ) : null}
                        {item.isPreorder && item.releaseDate ? (
                          <p className="text-xs text-text-secondary mb-1">
                            Lanzamiento: {new Date(item.releaseDate).toLocaleDateString('es-ES')}
                          </p>
                        ) : null}
                        <p className="text-sm text-text-secondary">
                          {item.price.toFixed(2)}€ × {item.quantity} unit{item.quantity !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Subtotal */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-bold text-text-primary">
                          {item.subtotal.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {sessionData.lineItems.some((i) => i.isPreorder) && (
                  <div className="mb-6 rounded-lg border border-warning/30 bg-warning-bg p-4 text-sm text-warning space-y-2">
                    <p className="font-bold">⚠️ Este pedido incluye productos en preventa.</p>
                    <p>Al realizar la reserva, garantizas tu unidad antes del lanzamiento oficial. Los artículos serán enviados una vez estén disponibles y hayan sido recibidos por TCG Iberia de nuestros distribuidores.</p>
                    <p>Si el pedido contiene productos en stock y productos en preventa, todo el pedido se enviará conjuntamente cuando los artículos en preventa estén disponibles. Las fechas de lanzamiento pueden variar por causas ajenas a TCG Iberia.</p>
                  </div>
                )}

                {/* Order Total */}
                <div className="border-t border-dark-border pt-6 bg-dark-bgSecondary rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-text-primary">Importe:</span>
                    <span className="text-base font-bold text-text-secondary">
                      {(sessionData.totalAmount / 1.21).toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-text-primary">IVA:</span>
                    <span className="text-base font-bold text-text-secondary">
                      {(sessionData.totalAmount - (sessionData.totalAmount / 1.21)).toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-text-primary">Envío:</span>
                    <span className="text-base font-bold text-text-secondary">
                      Gratis
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-text-primary">Total:</span>
                    <span className="text-xl font-bold text-premium-gold">
                      {sessionData.totalAmount.toFixed(2)}€
                    </span>
                  </div>
                  
                  <p className="text-xs text-text-secondary mt-2">
                    Estado del Pago: {sessionData.status === 'paid' ? '✓ Paid' : 'Processing'}
                  </p>
                </div>
              </div>
                </>
              )}

              {/* Support Info */}
              <div className="bg-dark-bgSecondary rounded-xl p-6 mb-8 border border-dark-border">
                <p className="text-text-primary mb-3 font-semibold">
                  ¿Necesita ayuda?
                </p>
                <p className="text-sm text-text-secondary mb-4">
                  Si tiene alguna pregunta o inquietud sobre su pedido, no dude en contactarnos. Nuestro equipo de soporte está aquí para ayudarle con cualquier consulta relacionada con su compra.
                </p>
                <div className="space-y-2 flex flex-col">
                  <a
                    href="https://wa.me/34689178762"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-premium-gold hover:text-premium-gold_dark font-semibold text-sm"
                  >
                    💬 Chatea en WhatsApp
                  </a>
                  <a
                    href="mailto:sales@tcgiberia.com"
                    className="text-premium-gold hover:text-premium-gold_dark font-semibold text-sm"
                  >
                    📧 Envíanos un Correo
                  </a>
                </div>
              </div>

              {/* Continue Shopping Button */}
              <div className="text-center">
                <a
                  href="/"
                  className="inline-block btn btn-primary"
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
