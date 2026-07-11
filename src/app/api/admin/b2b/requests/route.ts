/**
 * GET /api/admin/b2b/requests
 *
 * Returns the list of B2B account requests, ordered by most recent first.
 * Query params:
 *   ?status=PENDING|APPROVED|REJECTED (optional filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2bRequestStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';

const VALID_STATUSES: readonly B2bRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get('status');
  const status =
    rawStatus && VALID_STATUSES.includes(rawStatus as B2bRequestStatus)
      ? (rawStatus as B2bRequestStatus)
      : undefined;

  try {
    const requests = await db.b2bRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, status: true, activatedAt: true } },
      },
    });
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar la lista de solicitudes.' },
      { status: 500 }
    );
  }
}
