import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const language = searchParams.get('language');

    // Build the where clause based on query params
    const where: any = { visible: true };
    
    if (type) {
      where.type = {
        equals: type,
        mode: 'insensitive',
      };
    }
    
    if (language) {
      where.language = language;
    }

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
    captureServerError({
      error,
      module: 'products_api',
      request,
    });
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
