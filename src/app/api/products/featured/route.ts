import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    });

    const publicProducts = products.map((p: typeof products[0]) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: parseFloat(p.price.toString()),
      discountPercentage: p.discountPercentage ? parseFloat(p.discountPercentage.toString()) : null,
      stock: p.stock,
      imageUrl: p.imageUrl,
      language: p.language,
      priority: p.priority,
      available: p.stock > 0,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      type: p.type,
    }));

    return NextResponse.json(publicProducts);
  } catch (error) {
    console.error('GET /api/products error', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
