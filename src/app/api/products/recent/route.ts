import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';

export async function GET() {
  try {

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const where: any = {
      visible: true,
      createdAt: {
        gte: oneMonthAgo,
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
