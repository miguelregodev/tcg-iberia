/**
 * PATCH /api/admin/price-import/update-price
 *
 * Updates the price of a catalog product.
 *
 * Body:     { productId: string; price: number }
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

  let body: { productId?: unknown; price?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const priceRaw = body.price;

  if (!productId) {
    return NextResponse.json({ error: '"productId" es obligatorio.' }, { status: 400 });
  }

  const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw));
  if (isNaN(price) || price < 0) {
    return NextResponse.json({ error: '"price" debe ser un número positivo.' }, { status: 400 });
  }

  // Round to 2 decimal places
  const roundedPrice = Math.round(price * 100) / 100;

  try {
    const product = await db.product.update({
      where: { id: productId },
      data: { price: roundedPrice, discountPercentage: null },
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
