import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Fisher–Yates shuffle (in-place).
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const excludeId = searchParams.get('excludeId');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(
      Math.max(parseInt(limitParam || '12', 10) || 12, 1),
      48,
    );

    const where: any = {
      visible: true,
      stock: { gt: 0 },
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const products = await db.product.findMany({ where });

    const shuffled = shuffle([...products]).slice(0, limit);

    const publicProducts = shuffled.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: parseFloat(p.price.toString()),
      discountPercentage: p.discountPercentage
        ? parseFloat(p.discountPercentage.toString())
        : null,
      stock: p.stock,
      imageUrl: p.imageUrl,
      language: p.language,
      priority: p.priority,
      available: p.stock > 0,
      description: p.description,
      notes: p.notes,
      visible: p.visible,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      type: p.type,
    }));

    return NextResponse.json(publicProducts);
  } catch (error) {
    console.error('GET /api/products/random error', error);
    return NextResponse.json(
      { error: 'Failed to fetch random products' },
      { status: 500 },
    );
  }
}
