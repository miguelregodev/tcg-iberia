/**
 * GET /api/b2b/session
 *
 * Returns the current B2B session (customer summary + status) or `{ customer: null }`
 * when there is no active session. Consumed by the client-side context that
 * decides whether to swap in wholesale prices and expose the B2B account UI.
 *
 * Only the fields safe to expose to the browser are returned — bank details,
 * VAT number etc. are intentionally omitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getB2bSessionFromRequest } from '@/lib/b2b/session';

export async function GET(request: NextRequest) {
  const session = await getB2bSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ customer: null });
  }

  const { customer } = session;
  return NextResponse.json({
    customer: {
      id: customer.id,
      email: customer.email,
      companyName: customer.companyName,
      contactName: customer.contactName,
      status: customer.status,
    },
  });
}
