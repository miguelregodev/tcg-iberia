'use client';

import { useEffect, useState } from 'react';
import { getCookieConsent, setCookieConsent, type CookieConsent } from '@/lib/analytics/consent';

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent>('pending');

  useEffect(() => {
    setConsent(getCookieConsent());
  }, []);

  if (consent !== 'pending') {
    return null;
  }

  const accept = () => {
    setCookieConsent('accepted');
    setConsent('accepted');
  };

  const decline = () => {
    setCookieConsent('declined');
    setConsent('declined');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] rounded-xl border border-dark-border bg-dark-surface/95 p-4 shadow-elevated backdrop-blur md:left-auto md:max-w-xl">
      <p className="text-sm text-text-primary">
        Usamos cookies analíticas para mejorar la experiencia de compra. Puedes aceptar o rechazar en cualquier momento.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={decline}
          className="btn btn-secondary text-sm py-2 px-3"
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={accept}
          className="btn btn-primary text-sm py-2 px-3"
        >
          Aceptar Cookies
        </button>
      </div>
    </div>
  );
}
