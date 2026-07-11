/**
 * POST /api/admin/b2b/customers/[id]/disable
 *
 * Marks the customer as DISABLED and revokes every active session so any
 * open browser tabs are logged out immediately. The customer's data is
 * preserved so the account can be re-enabled later without re-approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { sendB2bAccountDisabledEmail } from '@/lib/b2b/emails';

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

  try {
    const [updated] = await db.$transaction([
      db.b2bCustomer.update({
        where: { id },
        data: { status: 'DISABLED', disabledAt: new Date() },
      }),
      db.b2bSession.deleteMany({ where: { customerId: id } }),
    ]);

    void sendB2bAccountDisabledEmail({
      email: updated.email,
      contactName: updated.contactName,
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'disabled_email' },
        extra: { customerId: id },
      });
    });

    return NextResponse.json({ customer: updated });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo desactivar el cliente.' },
      { status: 500 }
    );
  }
}
