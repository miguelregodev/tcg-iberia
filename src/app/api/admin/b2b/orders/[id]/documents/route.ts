/**
 * POST /api/admin/b2b/orders/[id]/documents
 *
 * Generate a document for an existing order (e.g. "Generate invoice later").
 * Body: {
 *   type: 'INVOICE' | 'PROFORMA' | 'QUOTATION' | 'CORRECTIVE_INVOICE',
 *   correctsDocumentId?: string, reason?: string   (corrective invoices only)
 *   number?: string   (REQUIRED for INVOICE / CORRECTIVE_INVOICE; optional for
 *                      PROFORMA / QUOTATION, which otherwise use their series)
 *   notifyCustomer?: boolean
 * }
 * Eligibility (no duplicate final invoices, issued invoices are never
 * replaced — only rectified) is enforced by the document service.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2bDocumentType } from '@prisma/client';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { emailB2bDocument, issueB2bDocument } from '@/lib/b2b/documents';
import { getAdminB2bOrderDetail, resolveB2bOrderUrl } from '@/lib/b2b/orders';
import { normalizeManualDocumentNumber } from '@/lib/b2b/order-numbers';
import { b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

const TYPES: readonly B2bDocumentType[] = ['INVOICE', 'PROFORMA', 'QUOTATION', 'CORRECTIVE_INVOICE'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const type = body.type as B2bDocumentType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo de documento no válido.' }, { status: 400 });
  }
  const manual = normalizeManualDocumentNumber(body.number);
  if (manual && 'error' in manual) {
    return NextResponse.json({ error: manual.error }, { status: 400 });
  }
  const actor = getAdminActor();

  try {
    const outcome = await issueB2bDocument({
      orderId: id,
      type,
      actor,
      correctsDocumentId: type === 'CORRECTIVE_INVOICE' ? optionalString(body.correctsDocumentId, 64) : null,
      correctionReason: type === 'CORRECTIVE_INVOICE' ? optionalString(body.reason, 1000) : null,
      manualNumber: manual?.number ?? null,
    });
    let email: { sent: boolean; error: string | null } | null = null;
    if (outcome.issued && body.notifyCustomer === true) {
      email = await emailB2bDocument({
        orderId: id,
        documentId: outcome.document.id,
        actor,
        orderUrl: resolveB2bOrderUrl(request.nextUrl.origin, id),
        pdf: outcome.pdf,
      });
    }
    return NextResponse.json(
      {
        success: outcome.issued,
        document: { id: outcome.document.id, number: outcome.document.number, status: outcome.document.status },
        error: outcome.error,
        email,
        order: await getAdminB2bOrderDetail(id),
      },
      { status: outcome.issued ? 201 : 202 }
    );
  } catch (err) {
    return b2bErrorResponse(err, 'admin_issue_document', { orderId: id, type });
  }
}
