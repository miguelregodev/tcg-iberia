/**
 * GET  /api/admin/price-import/mappings  — list all manual mappings
 * POST /api/admin/price-import/mappings  — create or update a manual mapping
 *
 * A mapping permanently links an imported product name (from Google Sheets) to
 * a catalog product ID. If a mapping already exists for the same importedName,
 * it is updated (upsert).
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mappings = await db.priceMapping.findMany({
      include: { product: { select: { id: true, name: true } } },
      orderBy: { importedName: 'asc' },
    });
    return NextResponse.json(mappings);
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar los mapeos.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { importedName?: unknown; productId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const importedName = typeof body.importedName === 'string' ? body.importedName.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';

  if (!importedName) {
    return NextResponse.json({ error: '"importedName" es obligatorio.' }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: '"productId" es obligatorio.' }, { status: 400 });
  }

  // Verify the product exists before creating the mapping
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
  }

  try {
    const mapping = await db.priceMapping.upsert({
      where: { importedName },
      create: { importedName, productId },
      update: { productId },
      include: { product: { select: { id: true, name: true } } },
    });
    return NextResponse.json(mapping, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el mapeo.' }, { status: 500 });
  }
}
