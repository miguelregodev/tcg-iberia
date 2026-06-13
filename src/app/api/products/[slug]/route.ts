import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';

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
    });

    if (!product || !product.visible) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 } 
      );
    }

    return NextResponse.json({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: parseFloat(product.price.toString()),
      discountPercentage: product.discountPercentage ? parseFloat(product.discountPercentage.toString()) : null,
      notes: product.notes,
      stock: product.stock,
      imageUrl: product.imageUrl,
      available: product.stock > 0,
    });
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