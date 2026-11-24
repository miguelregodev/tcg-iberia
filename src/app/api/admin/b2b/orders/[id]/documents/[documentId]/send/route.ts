/**
 * POST /api/admin/b2b/orders/[id]/documents/[documentId]/send
 *
 * Emails an ISSUED document (PDF read from the private bucket) to the
 * customer. The outcome is recorded in the order audit trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { emailB2bDocument } from '@/lib/b2b/documents';
import { resolveB2bOrderUrl } from '@/lib/b2b/orders';
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
    const result = await emailB2bDocument({
      orderId: id,
      documentId,
      actor: getAdminActor(),
      orderUrl: resolveB2bOrderUrl(request.nextUrl.origin, id),
    });
    return NextResponse.json(result, { status: result.sent ? 200 : 502 });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_send_document', { orderId: id, documentId });
  }
}
