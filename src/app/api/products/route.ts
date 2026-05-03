import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { visible: true },
      orderBy: { createdAt: 'desc' },
    });

    const publicProducts = products.map((p: typeof products[0]) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: parseFloat(p.price.toString()),
      discountPercentage: p.discountPercentage ? parseFloat(p.discountPercentage.toString()) : null,
      imageUrl: p.imageUrl,
      available: p.stock > 0,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json(publicProducts);
  } catch (error) {
    console.error('GET /api/products error', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
