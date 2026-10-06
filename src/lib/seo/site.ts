/**
 * Site-wide SEO constants. `NEXT_PUBLIC_APP_URL` must be the production origin
 * (https://tcgiberia.com) in Vercel so canonicals, sitemap and JSON-LD are absolute.
 */

const DEFAULT_SITE_URL = 'https://tcgiberia.com';

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (raw || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = 'TCG Iberia';
export const SITE_LOCALE = 'es_ES';
export const SITE_LANG = 'es';

export const SITE_CONTACT = {
  email: 'sales@tcgiberia.com',
  telephone: '+34689178762',
} as const;

export const DEFAULT_OG_IMAGE = '/images/pikachu-4-scaled.jpg';
export const LOGO_PATH = '/images/logo.png';

/** Builds an absolute URL from a path or passes through an already-absolute URL. */
export function absoluteUrl(pathOrUrl = '/'): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}
