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
    <div className="fixed bottom-4 left-4 right-4 z-[60] rounded-xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur md:left-auto md:max-w-xl">
      <p className="text-sm text-gray-800">
        Usamos cookies analíticas para mejorar la experiencia de compra. Puedes aceptar o rechazar en cualquier momento.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={decline}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={accept}
          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Aceptar Cookies
        </button>
      </div>
    </div>
  );
}
