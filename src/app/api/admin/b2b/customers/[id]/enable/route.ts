/**
 * POST /api/admin/b2b/customers/[id]/enable
 *
 * Re-enables a DISABLED customer (or does nothing if already ACTIVE).
 * If the customer has never activated their password (no passwordHash),
 * they will be re-set to PENDING and the admin will need to issue a new
 * activation link — refusing to silently activate an account that has
 * never proven possession of its email address.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { sendB2bAccountReactivatedEmail } from '@/lib/b2b/emails';

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

  const nextStatus = customer.passwordHash ? 'ACTIVE' : 'PENDING';

  try {
    const updated = await db.b2bCustomer.update({
      where: { id },
      data: {
        status: nextStatus,
        disabledAt: null,
      },
    });

    if (nextStatus === 'ACTIVE') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      void sendB2bAccountReactivatedEmail({
        email: updated.email,
        contactName: updated.contactName,
        loginUrl: `${appUrl}/`,
      }).catch((err) => {
        Sentry.captureException(err, {
          tags: { module: 'b2b', action: 'reactivated_email' },
          extra: { customerId: updated.id },
        });
      });
    }

    return NextResponse.json({ customer: updated });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo activar el cliente.' },
      { status: 500 }
    );
  }
}
