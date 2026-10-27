import { NextRequest, NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';
import { createAdminSessionToken } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { password?: unknown };
    const password = body.password;

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json(
        { error: 'Admin authentication is not configured.' },
        { status: 503 },
      );
    }
    if (typeof password !== 'string' || password !== adminPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('tcg_admin_auth', createAdminSessionToken(adminPassword), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    captureServerError({
      error,
      module: 'admin_auth_login_api',
      request,
    });
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}