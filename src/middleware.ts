/** Validates the signed admin API session in Edge middleware. */

import { NextRequest, NextResponse } from 'next/server';

async function isValidAdminCookie(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const [timestamp, signature, extra] = token.split('.');
  if (extra !== undefined || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const issuedAt = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 30 || now - issuedAt > 24 * 60 * 60) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp)),
  );
  const expected = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminApi =
    pathname.startsWith('/api/admin/') &&
    pathname !== '/api/admin/auth/login' &&
    pathname !== '/api/admin/auth/logout';
  const isAdminLoginPage = pathname === '/admin/login';
  const isAdminPage = !isAdminLoginPage && (pathname === '/admin' || pathname.startsWith('/admin/'));

  if (!isAdminApi && !isAdminPage && !isAdminLoginPage) return NextResponse.next();

  const authenticated = await isValidAdminCookie(
    request.cookies.get('tcg_admin_auth')?.value,
    process.env.ADMIN_PASSWORD,
  );

  if (isAdminApi && !authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Already signed in: never show the login form again, go to the admin home.
  if (isAdminLoginPage && authenticated) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  // Admin pages require a valid session; remember where the admin was going.
  if (isAdminPage && !authenticated) {
    const loginUrl = new URL('/admin/login', request.url);
    if (pathname !== '/admin') loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
