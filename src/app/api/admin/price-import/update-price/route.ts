/**
 * PATCH /api/admin/price-import/update-price
 *
 * Updates the managed retail / B2B price variants of a catalog product in a
 * single request.
 *
 * Body: {
 *   productId: string;
 *   prices: {
 *     sealed: number;
 *     liveOpening: number;
 *     b2b: number;
 *   }
 * }
 *
 * Response: { id: string; name: string; price: number }
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

export async function PATCH(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { productId?: unknown; price?: unknown; prices?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId) {
    return NextResponse.json({ error: '"productId" es obligatorio.' }, { status: 400 });
  }

  const pricesObject =
    body.prices && typeof body.prices === 'object' && !Array.isArray(body.prices)
      ? (body.prices as Record<string, unknown>)
      : null;

  const sealedRaw = pricesObject?.sealed ?? body.price;
  const liveOpeningRaw = pricesObject?.liveOpening ?? null;
  const b2bRaw = pricesObject?.b2b ?? null;

  const sealedPrice = parseNumber(sealedRaw);
  if (sealedPrice === null || Number.isNaN(sealedPrice) || sealedPrice < 0) {
    return NextResponse.json({ error: '"prices.sealed" debe ser un número positivo.' }, { status: 400 });
  }

  const liveOpeningPrice = parseNumber(liveOpeningRaw);
  const b2bPrice = parseNumber(b2bRaw);

  const roundedSealedPrice = Math.round(sealedPrice * 100) / 100;
  const roundedLiveOpeningPrice = liveOpeningPrice === null ? null : Math.round(liveOpeningPrice * 100) / 100;
  const roundedB2bPrice = b2bPrice === null ? null : Math.round(b2bPrice * 100) / 100;

  try {
    const product = await db.product.update({
      where: { id: productId },
      data: {
        price: roundedSealedPrice,
        liveOpeningPrice: roundedLiveOpeningPrice,
        b2bPrice: roundedB2bPrice,
        discountPercentage: null,
      },
      select: { id: true, name: true, price: true },
    });

    return NextResponse.json({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price.toString()),
    });
  } catch (err: unknown) {
    const isNotFound =
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2025';

    if (isNotFound) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'No se pudo actualizar el precio.' }, { status: 500 });
  }
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
