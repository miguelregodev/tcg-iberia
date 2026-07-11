/**
 * B2B activation endpoints.
 *
 *   GET  /api/b2b/activate/[token]
 *        Validates the token and returns the customer's contact name so the
 *        password-setup page can greet them by name. Returns 410 (Gone) when
 *        the token is invalid, expired, or has already been used.
 *
 *   POST /api/b2b/activate/[token]
 *        Consumes the token to set the customer's password and flip the
 *        account status from PENDING → ACTIVE. Immediately issues a session
 *        so the customer is logged in on the very next request.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/b2b/tokens';
import { createB2bSession } from '@/lib/b2b/session';
import { isValidPassword, PASSWORD_RULES_TEXT } from '@/lib/b2b/validation';
import { sendB2bAccountReadyEmail } from '@/lib/b2b/emails';

interface RouteContext {
  params: Promise<{ token: string }>;
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: 'Token requerido.' }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const record = await db.b2bActivationToken.findUnique({
    where: { tokenHash },
    include: { customer: { select: { id: true, email: true, contactName: true, companyName: true, status: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: 'Este enlace de activación ya no es válido. Contacta con sales@tcgiberia.com.' },
      { status: 410 }
    );
  }

  return NextResponse.json({
    valid: true,
    customer: {
      email: record.customer.email,
      contactName: record.customer.contactName,
      companyName: record.customer.companyName,
    },
    expiresAt: record.expiresAt.toISOString(),
  });
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: 'Token requerido.' }, { status: 400 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: PASSWORD_RULES_TEXT }, { status: 400 });
  }

  const tokenHash = hashToken(token);

  try {
    const record = await db.b2bActivationToken.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Este enlace de activación ya no es válido.' },
        { status: 410 }
      );
    }

    if (record.customer.status === 'DISABLED') {
      return NextResponse.json(
        {
          error:
            'Tu cuenta está inactiva. Contacta con sales@tcgiberia.com antes de continuar.',
        },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Atomically: set password, mark token used, activate account, and
    // invalidate ALL other pending activation tokens for the same customer.
    const [, updatedCustomer] = await db.$transaction([
      db.b2bActivationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      db.b2bCustomer.update({
        where: { id: record.customerId },
        data: {
          passwordHash,
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      }),
      db.b2bActivationToken.updateMany({
        where: {
          customerId: record.customerId,
          id: { not: record.id },
          usedAt: null,
        },
        data: { usedAt: new Date() },
      }),
    ]);

    // Issue a session so the user is logged in as soon as the redirect lands.
    const response = NextResponse.json({ success: true });
    await createB2bSession(updatedCustomer.id, response, {
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    });

    // Send the confirmation email fire-and-forget.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    void sendB2bAccountReadyEmail({
      email: updatedCustomer.email,
      contactName: updatedCustomer.contactName,
      companyName: updatedCustomer.companyName,
      loginUrl: `${appUrl}/`,
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'ready_email' },
        extra: { customerId: updatedCustomer.id },
      });
    });

    return response;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'activate' },
    });
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
