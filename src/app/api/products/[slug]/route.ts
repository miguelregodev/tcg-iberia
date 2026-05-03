import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await db.product.findUnique({
      where: { slug: params.slug },
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
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}