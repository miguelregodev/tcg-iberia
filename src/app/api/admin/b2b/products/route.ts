/**
 * GET /api/admin/b2b/products[?q=text]
 *
 * Product picker for the admin "create B2B order" form. Only visible products
 * WITH a wholesale price are returned (products without `b2bPrice` cannot be
 * ordered). Without `q` it returns all of them (the form filters/autocompletes
 * client-side); with `q` (≥ 2 chars) up to 20 matches by name/slug. Each item
 * carries the VAT-excluded B2B unit price (same `b2bNetPrice` rule used for pricing).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/b2b/admin-auth';
import { b2bNetPrice } from '@/lib/b2b/company';
import { b2bErrorResponse } from '@/lib/b2b/errors';

const MAX_ALL_PRODUCTS = 5000;

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) ?? '';
  if (q.length === 1) return NextResponse.json({ products: [] });

  try {
    const rows = await db.product.findMany({
      where: {
        visible: true,
        b2bPrice: { not: null },
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: q ? [{ priority: 'asc' }, { name: 'asc' }] : [{ name: 'asc' }],
      take: q ? 20 : MAX_ALL_PRODUCTS,
      select: { id: true, name: true, slug: true, language: true, imageUrl: true, stock: true, b2bPrice: true },
    });
    return NextResponse.json({
      products: rows.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.slug,
        language: p.language,
        imageUrl: p.imageUrl,
        stock: p.stock,
        unitPriceEur: p.b2bPrice === null ? null : b2bNetPrice(Number(p.b2bPrice)),
      })),
    });
  } catch (err) {
    return b2bErrorResponse(err, 'admin_product_search');
  }
}
