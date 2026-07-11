/**
 * POST /api/b2b/login
 *
 * Authenticates a B2B customer. Successful logins issue a `b2b_session`
 * cookie backed by a `B2bSession` row (see src/lib/b2b/session.ts).
 *
 * Access rules:
 *   - PENDING account (never activated)  → 403 with a friendly message.
 *   - DISABLED account                    → authenticates successfully but
 *                                          returns 403 with the "contact us"
 *                                          message. NO cookie is issued.
 *   - Wrong password / unknown email      → generic 401 (no user enumeration).
 *   - Rate limited                        → 429.
 *
 * All attempts are recorded in `B2bLoginAudit` for auditability + rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/b2b/validation';
import { isRateLimited, recordLoginAttempt } from '@/lib/b2b/rate-limit';
import { createB2bSession } from '@/lib/b2b/session';

function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Introduce email y contraseña.' },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
  }

  // ── Mutual exclusion with the regular customer session ─────────────────
  //    A single browser can hold only one identity at a time, so refuse the
  //    B2B login while a NextAuth (customer) session cookie is present. The
  //    user must sign out of the retail area first.
  const hasCustomerSession =
    !!request.cookies.get('authjs.session-token')?.value ||
    !!request.cookies.get('__Secure-authjs.session-token')?.value;
  if (hasCustomerSession) {
    return NextResponse.json(
      {
        error:
          'Ya has iniciado sesión como cliente particular. Cierra esa sesión antes de acceder al portal B2B.',
      },
      { status: 409 }
    );
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  // ── Rate limiting ─────────────────────────────────────────────────────────
  if (await isRateLimited(email, ipAddress)) {
    await recordLoginAttempt({
      email,
      success: false,
      reason: 'rate_limited',
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: 'Demasiados intentos. Vuelve a intentarlo en 15 minutos.' },
      { status: 429 }
    );
  }

  try {
    const customer = await db.b2bCustomer.findUnique({ where: { email } });

    // ── Unknown email ────────────────────────────────────────────────────────
    if (!customer || !customer.passwordHash) {
      await recordLoginAttempt({
        email,
        success: false,
        reason: customer ? 'not_activated' : 'unknown_email',
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Credenciales incorrectas.' },
        { status: 401 }
      );
    }

    // ── Password check ───────────────────────────────────────────────────────
    const ok = await bcrypt.compare(password, customer.passwordHash);
    if (!ok) {
      await recordLoginAttempt({
        email,
        customerId: customer.id,
        success: false,
        reason: 'invalid_password',
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Credenciales incorrectas.' },
        { status: 401 }
      );
    }

    // ── Disabled account: authenticate but refuse access ─────────────────────
    if (customer.status === 'DISABLED') {
      await recordLoginAttempt({
        email,
        customerId: customer.id,
        success: true,
        reason: 'disabled',
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        {
          error:
            'Tu cuenta B2B está inactiva. Contacta con sales@tcgiberia.com para más información.',
          disabled: true,
        },
        { status: 403 }
      );
    }

    // ── Pending activation ───────────────────────────────────────────────────
    if (customer.status === 'PENDING') {
      await recordLoginAttempt({
        email,
        customerId: customer.id,
        success: true,
        reason: 'pending_activation',
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        {
          error:
            'Tu cuenta todavía no está activada. Revisa tu correo o contacta con sales@tcgiberia.com.',
        },
        { status: 403 }
      );
    }

    // ── ACTIVE — issue session ───────────────────────────────────────────────
    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        companyName: customer.companyName,
        contactName: customer.contactName,
      },
    });

    await createB2bSession(customer.id, response, { ipAddress, userAgent });

    // Update lastLoginAt fire-and-forget.
    void db.b2bCustomer
      .update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } })
      .catch(() => undefined);

    await recordLoginAttempt({
      email,
      customerId: customer.id,
      success: true,
      reason: 'ok',
      ipAddress,
      userAgent,
    });

    return response;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'login' },
      extra: { email },
    });
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
