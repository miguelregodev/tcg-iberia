'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { getCookieConsent } from '@/lib/analytics/consent';
import { initPostHog, shutdownPostHog } from '@/lib/analytics/posthog';
import { PageViewTracker } from '@/components/analytics/PageViewTracker';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  const hasKey = useMemo(() => {
    return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST);
  }, []);

  useEffect(() => {
    if (!hasKey) return;

    const consent = getCookieConsent();
    if (consent !== 'accepted') {
      setEnabled(false);
      return;
    }

    const didInit = initPostHog();
    setEnabled(didInit);

    return () => {
      shutdownPostHog();
    };
  }, [hasKey]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'tcg_cookie_consent_v1') return;

      const consent = getCookieConsent();
      if (consent === 'accepted') {
        const didInit = initPostHog();
        setEnabled(didInit);
        return;
      }

      setEnabled(false);
      shutdownPostHog();
    };

    const onConsentChanged = () => {
      const consent = getCookieConsent();
      if (consent === 'accepted') {
        const didInit = initPostHog();
        setEnabled(didInit);
        return;
      }

      setEnabled(false);
      shutdownPostHog();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('tcg:cookie-consent-changed', onConsentChanged as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('tcg:cookie-consent-changed', onConsentChanged as EventListener);
    };
  }, []);

  return (
    <>
      {enabled ? (
        // useSearchParams inside PageViewTracker requires a Suspense boundary in Next.js 15
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
      ) : null}
      {children}
    </>
  );
}
