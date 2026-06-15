import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';

export async function GET() {
  try {

    // Build the where clause based on query params
    const where: any = { visible: true ,
      priority: {
        lt: 8,
      },
    };

    const products = await db.product.findMany({
      where,
      orderBy: { priority: 'asc' },
      take: 12,
      select: publicProductSelect,
    });

    const publicProducts = products.map(serializePublicProduct);

    return NextResponse.json(publicProducts);
  } catch (error) {
    console.error('GET /api/products error', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
