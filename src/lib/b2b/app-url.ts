/** Resolve email links against the configured public URL or the current request. */
export function getB2bAppUrl(requestOrigin: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/^["']+|["']+$/g, '');
  const url = new URL(configuredUrl || requestOrigin);

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (process.env.NODE_ENV === 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new Error('NEXT_PUBLIC_APP_URL must be a public HTTP(S) URL.');
  }

  return url.origin;
}
