'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import * as Sentry from '@sentry/nextjs';
import { StockAlertModal } from './StockAlertModal';
import { trackStockAlertCreated } from '@/lib/analytics/events';

type StockAlertButtonProps = {
  productId: string;
  productName: string;
  productCategory?: string;
  productPrice?: number;
  className?: string;
};

function getEmailDomain(email?: string): string | undefined {
  if (!email) return undefined;
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : undefined;
}

export function StockAlertButton({
  productId,
  productName,
  productCategory,
  productPrice,
  className = '',
}: StockAlertButtonProps) {
  const { data: session } = useSession();

  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const sendSubscription = async (email?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          ...(email ? { email } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? 'No se pudo crear la alerta.');
      }

      if (json.alreadyExists) {
        setAlreadySubscribed(true);
        showToast('Ya tienes una alerta activa para este producto.');
        return;
      }

      setAlreadySubscribed(true);
      showToast('Te avisaremos cuando este producto vuelva a estar disponible.');

      trackStockAlertCreated({
        productId,
        productName,
        category: productCategory,
        price: productPrice,
        emailDomain: getEmailDomain(email ?? session?.user?.email ?? undefined),
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { module: 'StockAlertButton', action: 'create_alert' },
        extra: { productId },
      });

      showToast(error instanceof Error ? error.message : 'Ha ocurrido un error. Inténtalo de nuevo.');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleClick = async () => {
    if (alreadySubscribed) {
      showToast('Ya tienes una alerta activa para este producto.');
      return;
    }

    if (session?.user?.email) {
      await sendSubscription();
      return;
    }

    setModalOpen(true);
  };

  const handleGuestSubmit = async (email: string) => {
    try {
      await sendSubscription(email);
      setModalOpen(false);
    } catch {
      // Modal keeps open and StockAlertModal handles input validation feedback.
    }
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleClick}
          disabled={submitting || alreadySubscribed}
          className={`btn w-full text-center font-bold py-4 text-lg transition-all hover:shadow-xl ${
            alreadySubscribed
              ? 'bg-green-600 text-white cursor-default'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {submitting
            ? 'Guardando...'
            : alreadySubscribed
            ? 'Te avisaremos'
            : 'Notifícame'}
        </button>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 animate-fadeIn"
          >
            {toast}
          </div>
        )}
      </div>

      <StockAlertModal
        isOpen={modalOpen}
        loading={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleGuestSubmit}
      />
    </>
  );
}
