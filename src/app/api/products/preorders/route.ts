import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: {
        visible: true,
        releaseDate: {
          gt: new Date(),
        },
      },
      orderBy: [{ releaseDate: 'asc' }, { priority: 'asc' }],
      take: 12,
      select: publicProductSelect,
    });

    return NextResponse.json(products.map(serializePublicProduct));
  } catch (error) {
    console.error('GET /api/products/preorders error', error);
    return NextResponse.json(
      { error: 'Failed to fetch preorder products' },
      { status: 500 },
    );
  }
}