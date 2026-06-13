import { NextRequest, NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('tcg_admin_auth', 'authenticated', {
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