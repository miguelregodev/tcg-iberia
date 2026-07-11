/**
 * POST /api/admin/b2b/customers/[id]/resend-activation
 *
 * Issues a fresh activation token for a customer that hasn't finished the
 * activation flow (or whose original link has expired) and resends the
 * activation email. All previous unused tokens for the customer are
 * invalidated so only the newest link works.
 *
 * Also usable for password recovery — an admin can trigger a new activation
 * link at any time; setting a new password re-activates the account.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { issueActivationToken } from '@/lib/b2b/tokens';
import { sendB2bActivationEmail } from '@/lib/b2b/emails';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const customer = await db.b2bCustomer.findUnique({ where: { id } });
  if (!customer) {
    return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  }
  if (customer.status === 'DISABLED') {
    return NextResponse.json(
      { error: 'El cliente está desactivado. Actívalo antes de reenviar el enlace.' },
      { status: 409 }
    );
  }

  const token = issueActivationToken();

  try {
    await db.$transaction([
      // Invalidate all unused tokens for this customer.
      db.b2bActivationToken.updateMany({
        where: { customerId: id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      db.b2bActivationToken.create({
        data: {
          customerId: id,
          tokenHash: token.hash,
          expiresAt: token.expiresAt,
        },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const activationUrl = `${appUrl}/b2b/activar/${token.raw}`;

    void sendB2bActivationEmail({
      email: customer.email,
      contactName: customer.contactName,
      companyName: customer.companyName,
      activationUrl,
      expiresAt: token.expiresAt,
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'resend_activation_email' },
        extra: { customerId: id },
      });
    });

    return NextResponse.json({ success: true, activationLink: activationUrl });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo reenviar el enlace.' },
      { status: 500 }
    );
  }
}
