/**
 * GET /api/b2b/profile
 *
 * Returns the authenticated B2B customer's own profile. Broader than the
 * `/api/b2b/session` endpoint — includes address, VAT, phone, activity, etc.
 * so the /mi-cuenta/b2b/perfil page can render the full profile card.
 *
 * The customer must have an ACTIVE session (PENDING and DISABLED accounts
 * cannot view the profile).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveB2bCustomer } from '@/lib/b2b/session';

const ACTIVITY_LABEL: Record<string, string> = {
  ONLINE_STORE: 'Tienda online',
  VENDING_MACHINE: 'Vending',
  PHYSICAL_STORE: 'Tienda física',
  DISTRIBUTOR: 'Distribuidor',
  OTHER: 'Otro',
};

export async function GET(request: NextRequest) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    customer: {
      id: customer.id,
      email: customer.email,
      status: customer.status,
      companyName: customer.companyName,
      vatNumber: customer.vatNumber,
      activity: customer.activity,
      activityLabel:
        customer.activity === 'OTHER' && customer.activityOther
          ? customer.activityOther
          : ACTIVITY_LABEL[customer.activity] ?? customer.activity,
      shippingAddress: customer.shippingAddress,
      billingAddress: customer.billingAddress,
      contactName: customer.contactName,
      nationalId: customer.nationalId,
      phone: customer.phone,
      website: customer.website,
      estimatedVolume: customer.estimatedVolume,
      preferredLanguages: customer.preferredLanguages,
      notes: customer.notes,
      lastLoginAt: customer.lastLoginAt,
      activatedAt: customer.activatedAt,
      createdAt: customer.createdAt,
    },
  });
}
