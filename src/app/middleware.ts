import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin routes (existing cookie-based protection) ──────────────────────
  if (pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get('tcg_admin_auth');

    if (!authCookie && pathname !== '/admin/login') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    if (authCookie && pathname === '/admin/login') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
  }

  // ── User account routes (Auth.js session-based protection) ───────────────
  if (pathname.startsWith('/mi-cuenta')) {
    const session = await auth();

    if (!session?.user) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('login', '1');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/mi-cuenta/:path*'],
};