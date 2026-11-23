/**
 * GET   /api/admin/b2b/orders/[id] — full admin detail (documents + audit trail).
 * PATCH /api/admin/b2b/orders/[id] — update notes.
 *        Body: { internalNotes?: string | null, notes?: string | null }
 *        `internalNotes` are admin-only; `notes` are visible to the customer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { getAdminB2bOrderDetail, updateB2bOrderNotes } from '@/lib/b2b/orders';
import { b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    return NextResponse.json({ order: await getAdminB2bOrderDetail(id) });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_order_detail', { orderId: id });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (!('internalNotes' in body) && !('notes' in body)) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  try {
    await updateB2bOrderNotes({
      orderId: id,
      actor: getAdminActor(),
      ...('internalNotes' in body && { internalNotes: optionalString(body.internalNotes, 5000) }),
      ...('notes' in body && { notes: optionalString(body.notes, 2000) }),
    });
    return NextResponse.json({ order: await getAdminB2bOrderDetail(id) });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_update_notes', { orderId: id });
  }
}
