import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await db.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const slug = body.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const product = await db.product.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        price: parseFloat(body.price),
        discountPercentage: body.discountPercentage ? parseFloat(body.discountPercentage) : null,
        noShrinkPrice: body.noShrinkPrice ? parseFloat(body.noShrinkPrice) : null,
        b2bPrice:
          body.b2bPrice !== undefined && body.b2bPrice !== null && body.b2bPrice !== ''
            ? parseFloat(body.b2bPrice)
            : null,
        b2bPriceNoShrink:
          body.b2bPriceNoShrink !== undefined &&
          body.b2bPriceNoShrink !== null &&
          body.b2bPriceNoShrink !== ''
            ? parseFloat(body.b2bPriceNoShrink)
            : null,
        notes: body.notes || null,
        type: body.type || null,
        releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
        stock: parseInt(body.stock),
        noShrinkStock: body.noShrinkStock ? parseInt(body.noShrinkStock) : 0,
        imageUrl: body.imageUrl,
        language: body.language || 'ENGLISH',
        priority: body.priority !== undefined ? parseInt(body.priority) : 999,
        visible: body.visible ?? true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}