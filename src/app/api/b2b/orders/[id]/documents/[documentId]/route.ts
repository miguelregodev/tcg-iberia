/**
 * GET /api/b2b/orders/[id]/documents/[documentId]
 *
 * Streams an ISSUED document PDF from the private R2 bucket to its owner.
 * Authorization is enforced in a single query that requires the document to
 * belong to the given order AND the order/document to belong to the
 * authenticated customer — tampering with either ID returns 404. Storage
 * keys are never accepted from or exposed to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveB2bCustomer } from '@/lib/b2b/session';
import { documentPdfResponse, readIssuedDocumentPdf } from '@/lib/b2b/documents';
import { b2bErrorResponse } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string; documentId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, documentId } = await context.params;

  const doc = await db.b2bDocument.findFirst({
    where: {
      id: documentId,
      orderId: id,
      customerId: customer.id,
      status: 'ISSUED',
      order: { customerId: customer.id },
    },
    select: { number: true, status: true, storageKey: true },
  });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
  }

  try {
    const pdf = await readIssuedDocumentPdf(doc);
    return documentPdfResponse(doc.number, pdf, 'attachment');
  } catch (err) {
    return b2bErrorResponse(err, 'customer_document_download', { documentId });
  }
}
