/**
 * GET /api/admin/b2b/customers
 *
 * Returns the paginated list of B2B customers with basic profile info + login
 * metadata. Query params:
 *   ?status=PENDING|ACTIVE|DISABLED   (optional filter)
 *   ?q=freeText                       (matches email / company / vat)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2bCustomerStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';

const VALID_STATUSES: readonly B2bCustomerStatus[] = ['PENDING', 'ACTIVE', 'DISABLED'];

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim() ?? '';

  const where: Prisma.B2bCustomerWhereInput = {};
  if (rawStatus && VALID_STATUSES.includes(rawStatus as B2bCustomerStatus)) {
    where.status = rawStatus as B2bCustomerStatus;
  }
  if (q.length > 0) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { vatNumber: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
    ];
  }

  try {
    const customers = await db.b2bCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar la lista de clientes.' },
      { status: 500 }
    );
  }
}
