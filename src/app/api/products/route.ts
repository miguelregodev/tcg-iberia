import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';

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
      select: publicProductSelect,
    });

    const publicProducts = products.map(serializePublicProduct);

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
