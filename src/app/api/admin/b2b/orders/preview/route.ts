/**
 * POST /api/admin/b2b/orders/preview
 *
 * Server-side price calculation for the admin "create order" summary. Uses
 * exactly the same pricing service as order creation, so what the admin
 * reviews is what will be persisted. Nothing is written.
 *
 * Body: { items: [{ productId, quantity, discountPercent? }], shippingCost?, customerId? }
 * When `customerId` belongs to a customer under "Recargo de Equivalencia" the
 * surcharge is included, exactly as order creation will apply it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { parseOrderLines, parseShippingCost } from '@/lib/b2b/pricing';
import { db } from '@/lib/db';
import { priceB2bLines, surchargeRateFor } from '@/lib/b2b/orders';
import { b2bErrorResponse, optionalString, readJsonBody } from '@/lib/b2b/errors';

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await readJsonBody(request);
  const { lines, errors } = parseOrderLines(body.items, { strict: true, allowDiscount: true });
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(' '), errors }, { status: 400 });
  }
  const shipping = parseShippingCost(body.shippingCost);
  if ('error' in shipping) {
    return NextResponse.json({ error: shipping.error }, { status: 400 });
  }

  try {
    const customerId = optionalString(body.customerId, 64);
    const customer = customerId
      ? await db.b2bCustomer.findUnique({ where: { id: customerId }, select: { equivalenceSurcharge: true } })
      : null;
    const pricing = await priceB2bLines(lines, shipping.cents, surchargeRateFor(customer));
    return NextResponse.json({ pricing });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_preview_order');
  }
}
