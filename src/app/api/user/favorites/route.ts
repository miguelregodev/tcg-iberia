import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/user/favorites — list all favorites, or check status for one product
// ?productId=xxx returns { isFavorited: boolean }
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const productId = request.nextUrl.searchParams.get('productId');

    // Status check for a single product
    if (productId) {
      const existing = await db.favorite.findUnique({
        where: { userId_productId: { userId: session.user.id, productId } },
        select: { id: true },
      });
      return NextResponse.json({ success: true, isFavorited: !!existing });
    }

    // Full list
    const favorites = await db.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            discountPercentage: true,
            imageUrl: true,
            stock: true,
            type: true,
            visible: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: favorites });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/favorites', method: 'GET' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// POST /api/user/favorites — add a product to favorites, increment favoriteCount
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body as { productId?: string };

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId es obligatorio.' }, { status: 400 });
    }

    // Verify product exists
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }

    // Check if already favorited (avoid double-incrementing)
    const existing = await db.favorite.findUnique({
      where: { userId_productId: { userId: session.user.id, productId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ success: true, data: existing }, { status: 200 });
    }

    // Create favorite + increment counter atomically
    const [favorite] = await db.$transaction([
      db.favorite.create({ data: { userId: session.user.id, productId } }),
      db.product.update({
        where: { id: productId },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true, data: favorite }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/favorites', method: 'POST' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// DELETE /api/user/favorites?productId=xxx — remove a favorite, decrement favoriteCount
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const productId = request.nextUrl.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json({ error: 'productId es obligatorio.' }, { status: 400 });
    }

    // Only decrement if the favorite actually existed
    const existing = await db.favorite.findUnique({
      where: { userId_productId: { userId: session.user.id, productId } },
      select: { id: true },
    });

    if (existing) {
      await db.$transaction([
        db.favorite.delete({ where: { id: existing.id } }),
        db.product.update({
          where: { id: productId },
          data: { favoriteCount: { decrement: 1 } },
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/favorites', method: 'DELETE' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
