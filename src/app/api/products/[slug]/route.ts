import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  let slug: string | undefined;

  try {
    const resolvedParams = await params;
    slug = resolvedParams.slug;
    const product = await db.product.findUnique({
      where: { slug },
      select: publicProductSelect,
    });

    if (!product || !product.visible) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 } 
      );
    }

    return NextResponse.json(serializePublicProduct(product));
  } catch (error) {
    captureServerError({
      error,
      module: 'products_slug_api',
      request,
      productId: slug,
    });
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}