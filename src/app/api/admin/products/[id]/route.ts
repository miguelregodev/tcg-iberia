import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { deleteFromSupabaseStorage } from '@/lib/supabase-storage';
import * as Sentry from '@sentry/nextjs';
import { dispatchStockAlertsForProduct } from '@/lib/stock-alerts';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const previous = await db.product.findUnique({
      where: { id },
      select: { id: true, stock: true },
    });

    if (!previous) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const nextStock = parseInt(body.stock);
    const product = await db.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        price: parseFloat(body.price),
        discountPercentage: body.discountPercentage ? parseFloat(body.discountPercentage) : null,
        noShrinkPrice: body.noShrinkPrice ? parseFloat(body.noShrinkPrice) : null,
        b2bPrice:
          body.b2bPrice === undefined
            ? undefined
            : body.b2bPrice === null || body.b2bPrice === ''
              ? null
              : parseFloat(body.b2bPrice),
        b2bPriceNoShrink:
          body.b2bPriceNoShrink === undefined
            ? undefined
            : body.b2bPriceNoShrink === null || body.b2bPriceNoShrink === ''
              ? null
              : parseFloat(body.b2bPriceNoShrink),
        notes: body.notes || null,
        type: body.type || null,
        releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
        stock: nextStock,
        noShrinkStock: body.noShrinkStock !== undefined ? parseInt(body.noShrinkStock) : undefined,
        imageUrl: body.imageUrl,
        language: body.language || 'ENGLISH',
        priority: body.priority !== undefined ? parseInt(body.priority) : undefined,
        visible: body.visible,
      },
    });

    // Trigger alerts only when product transitions from out-of-stock to available.
    if (previous.stock === 0 && nextStock > 0) {
      try {
        await dispatchStockAlertsForProduct(product.id);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            module: 'admin_products_api',
            action: 'dispatch_stock_alerts',
          },
          extra: {
            productId: product.id,
            previousStock: previous.stock,
            nextStock,
          },
        });
      }
    }

    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await db.product.findUnique({ where: { id } });
    if (existing?.imageUrl) {
      try {
        await deleteFromSupabaseStorage(existing.imageUrl);
      } catch (err) {
        console.warn('Failed to delete image from storage:', err);
      }
    }

    await db.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}