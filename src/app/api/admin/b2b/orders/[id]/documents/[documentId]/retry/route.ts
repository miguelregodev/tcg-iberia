/**
 * POST /api/admin/b2b/orders/[id]/documents/[documentId]/retry
 *
 * Retries a FAILED (or abandoned GENERATING) document. The retry reuses the
 * document's number, frozen payload and storage key, so it never creates a
 * duplicate document or file. ISSUED documents cannot be regenerated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { retryB2bDocument } from '@/lib/b2b/documents';
import { getAdminB2bOrderDetail } from '@/lib/b2b/orders';
import { b2bErrorResponse } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string; documentId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, documentId } = await context.params;

  try {
    const outcome = await retryB2bDocument({ orderId: id, documentId, actor: getAdminActor() });
    return NextResponse.json(
      {
        success: outcome.issued,
        error: outcome.error,
        order: await getAdminB2bOrderDetail(id),
      },
      { status: outcome.issued ? 200 : 202 }
    );
  } catch (err) {
    return b2bErrorResponse(err, 'admin_retry_document', { orderId: id, documentId });
  }
}
