/**
 * GET /api/admin/b2b/orders/[id]/documents/[documentId]?download=1
 *
 * Streams an ISSUED document from the private bucket to an authenticated
 * admin (inline preview by default, attachment with ?download=1). The
 * document must belong to the order in the URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { documentPdfResponse, readIssuedDocumentPdf } from '@/lib/b2b/documents';
import { b2bErrorResponse } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string; documentId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, documentId } = await context.params;

  const doc = await db.b2bDocument.findFirst({
    where: { id: documentId, orderId: id },
    select: { number: true, status: true, storageKey: true },
  });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
  }

  try {
    const pdf = await readIssuedDocumentPdf(doc);
    const download = request.nextUrl.searchParams.get('download') === '1';
    return documentPdfResponse(doc.number, pdf, download ? 'attachment' : 'inline');
  } catch (err) {
    return b2bErrorResponse(err, 'admin_document_download', { documentId });
  }
}
