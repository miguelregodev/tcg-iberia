export const COOKIE_CONSENT_KEY = 'tcg_cookie_consent_v1';

export type CookieConsent = 'accepted' | 'declined' | 'pending';

export function getCookieConsent(): CookieConsent {
  if (typeof window === 'undefined') return 'pending';

  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  if (value === 'accepted' || value === 'declined') {
    return value;
  }

  return 'pending';
}

export function setCookieConsent(consent: Exclude<CookieConsent, 'pending'>) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  window.dispatchEvent(new CustomEvent('tcg:cookie-consent-changed', { detail: consent }));
}
