/**
 * GET /api/b2b/prices?ids=id1,id2,id3
 *
 * Returns the wholesale price map for the requested product IDs. Only ACTIVE
 * B2B sessions receive data — anonymous or non-active callers get 401/403.
 *
 * Response:
 *   { prices: { [productId]: { b2bPrice: number|null, b2bPriceNoShrink: number|null } } }
 *
 * The endpoint intentionally accepts a batch of IDs so a product listing page
 * can fetch every override in a single round-trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveB2bCustomer } from '@/lib/b2b/session';

const MAX_IDS = 200;

export async function GET(request: NextRequest) {
  const customer = await getActiveB2bCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  try {
    console.log("IDS:", ids);

    const rows = await db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, b2bPrice: true, b2bPriceNoShrink: true },
    });

    console.log("ROWS:", rows);

    const prices: Record<
      string,
      { b2bPrice: number | null; b2bPriceNoShrink: number | null }
    > = {};
    for (const r of rows) {
      prices[r.id] = {
        b2bPrice: r.b2bPrice ? Number(r.b2bPrice) : null,
        b2bPriceNoShrink: r.b2bPriceNoShrink ? Number(r.b2bPriceNoShrink) : null,
      };
    }
    console.log("PRICES:", prices);
    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron cargar los precios B2B.' },
      { status: 500 }
    );
  }
}
