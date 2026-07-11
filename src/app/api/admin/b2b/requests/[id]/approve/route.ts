/**
 * POST /api/admin/b2b/requests/[id]/approve
 *
 * Creates a `B2bCustomer` from the collected documentation, links it back to
 * the request, generates a one-time activation token, and sends the
 * activation email. The customer starts in PENDING status until they use the
 * activation link to set their password.
 *
 * Requirements before approval:
 *   - status must be PENDING
 *   - the following fields must be present on the request:
 *       companyName, vatNumber, activity, shippingAddress, contactName, phone
 *
 * The endpoint is atomic: all DB writes happen in a single transaction so an
 * approval either succeeds fully or leaves the request unchanged.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { issueActivationToken, B2B_ACTIVATION_TOKEN_TTL_HOURS } from '@/lib/b2b/tokens';
import { sendB2bActivationEmail } from '@/lib/b2b/emails';
import { isValidEmail } from '@/lib/b2b/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const req = await db.b2bRequest.findUnique({ where: { id } });
  if (!req) {
    return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  }
  if (req.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'La solicitud ya ha sido procesada.' },
      { status: 409 }
    );
  }

  // ── Validate required fields ─────────────────────────────────────────────
  const missing: string[] = [];
  if (!req.companyName?.trim()) missing.push('Razón social');
  if (!req.vatNumber?.trim()) missing.push('NIF/CIF');
  if (!req.activity) missing.push('Tipo de actividad');
  if (!req.shippingAddress?.trim()) missing.push('Dirección de envío');
  if (!req.contactName?.trim()) missing.push('Persona de contacto');
  if (!req.phone?.trim()) missing.push('Teléfono');
  if (!isValidEmail(req.email)) missing.push('Email válido');

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Faltan campos obligatorios: ${missing.join(', ')}.`,
        missing,
      },
      { status: 400 }
    );
  }

  // ── Uniqueness: refuse if a customer already exists with this email ─────
  const existingCustomer = await db.b2bCustomer.findUnique({
    where: { email: req.email },
    select: { id: true },
  });
  if (existingCustomer) {
    return NextResponse.json(
      { error: 'Ya existe un cliente B2B con ese email.' },
      { status: 409 }
    );
  }

  const activationToken = issueActivationToken();
  const adminEmail =
    request.cookies.get('tcg_admin_auth')?.value ?? 'admin@tcgiberia.com';

  try {
    const { customer } = await db.$transaction(async (tx) => {
      const customer = await tx.b2bCustomer.create({
        data: {
          email: req.email,
          status: 'PENDING',
          companyName: req.companyName!,
          vatNumber: req.vatNumber!,
          activity: req.activity!,
          activityOther: req.activityOther,
          shippingAddress: req.shippingAddress!,
          billingAddress: req.billingAddress,
          contactName: req.contactName!,
          nationalId: req.nationalId,
          phone: req.phone!,
          website: req.website,
          estimatedVolume: req.estimatedVolume,
          preferredLanguages: req.preferredLanguages,
          notes: req.notes,
        },
      });

      await tx.b2bActivationToken.create({
        data: {
          customerId: customer.id,
          tokenHash: activationToken.hash,
          expiresAt: activationToken.expiresAt,
        },
      });

      await tx.b2bRequest.update({
        where: { id: req.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedByEmail: adminEmail,
          customerId: customer.id,
        },
      });

      return { customer };
    });

    // Send activation email fire-and-forget.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const activationUrl = `${appUrl}/b2b/activar/${activationToken.raw}`;
    void sendB2bActivationEmail({
      email: customer.email,
      contactName: customer.contactName,
      companyName: customer.companyName,
      activationUrl,
      expiresAt: activationToken.expiresAt,
    }).catch((err) => {
      Sentry.captureException(err, {
        tags: { module: 'b2b', action: 'activation_email' },
        extra: { customerId: customer.id },
      });
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        status: customer.status,
      },
      // Included so admins can copy the link manually if the email is delayed.
      activationLink: activationUrl,
      activationExpiresInHours: B2B_ACTIVATION_TOKEN_TTL_HOURS,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'approve' },
      extra: { requestId: req.id },
    });
    return NextResponse.json({ error: 'No se pudo aprobar la solicitud.' }, { status: 500 });
  }
}
