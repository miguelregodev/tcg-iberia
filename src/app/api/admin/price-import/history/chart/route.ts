/**
 * GET /api/admin/price-import/history/chart?variant=SHRINK|NO_SHRINK
 *
 * Returns all historical purchase-price series for all products with the
 * given variant, grouped by product ID.
 *
 * Response:
 *   {
 *     products: [
 *       { productId, productName, points: [{ date, purchasePriceEur, priceJpy, exchangeRate }] }
 *     ]
 *   }
 *
 * Days without imports are simply absent from the response — the client draws
 * straight segments between consecutive points and does NOT interpolate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductVariant } from '@prisma/client';
import { getPriceHistoryChartByVariant } from '@/lib/price-import/history';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

function isValidVariant(v: string): v is ProductVariant {
  return v === 'SHRINK' || v === 'NO_SHRINK';
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const variant = url.searchParams.get('variant')?.trim() ?? '';

  if (!isValidVariant(variant)) {
    return NextResponse.json(
      { error: '"variant" debe ser SHRINK o NO_SHRINK.' },
      { status: 400 }
    );
  }

  try {
    const grouped = await getPriceHistoryChartByVariant(variant);
    const products = Array.from(grouped.entries()).map(([productId, data]) => ({
      productId,
      productName: data.productName,
      points: data.points,
    }));

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar el histórico de precios.' },
      { status: 500 }
    );
  }
}
