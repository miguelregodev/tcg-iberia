/**
 * POST /api/b2b/request
 *
 * Public endpoint used by the "Request a B2B account" form. Creates a
 * B2bRequest with status PENDING and fires an automatic documentation email
 * to the prospect plus a notification to the sales inbox.
 *
 * The endpoint is intentionally forgiving: repeat submissions with the same
 * email while an existing request is still PENDING return success without
 * creating duplicates — this prevents enumeration of already-submitted emails
 * and avoids spamming the prospect with the same doc-request email.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/b2b/validation';
import {
  sendB2bDocumentationRequestEmail,
  sendB2bRequestAdminNotification,
} from '@/lib/b2b/emails';

export async function POST(request: NextRequest) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!rawEmail || !isValidEmail(rawEmail)) {
    return NextResponse.json(
      { error: 'Introduce un correo electrónico válido.' },
      { status: 400 }
    );
  }

  try {
    // ── Idempotency: avoid duplicating pending requests for the same email ──
    const existingPending = await db.b2bRequest.findFirst({
      where: { email: rawEmail, status: 'PENDING' },
      select: { id: true },
    });

    if (existingPending) {
      // Silently succeed — the prospect probably re-submitted the form.
      return NextResponse.json({ success: true }, { status: 200 });
    }

    await db.b2bRequest.create({
      data: {
        email: rawEmail,
        status: 'PENDING',
      },
    });

    // Emails are fire-and-forget: request creation must not fail if the SMTP
    // hop is temporarily down, but the failures are captured in Sentry.
    void Promise.allSettled([
      sendB2bDocumentationRequestEmail(rawEmail),
      sendB2bRequestAdminNotification(rawEmail),
    ]).then((results) => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          Sentry.captureException(r.reason, {
            tags: { module: 'b2b', action: i === 0 ? 'docs_email' : 'admin_email' },
            extra: { email: rawEmail },
          });
        }
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'create_request' },
      extra: { email: rawEmail },
    });
    return NextResponse.json(
      { error: 'No se pudo registrar la solicitud. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
