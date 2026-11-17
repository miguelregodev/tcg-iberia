import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { dispatchStockAlertsForProduct } from '@/lib/stock-alerts';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { stock } = body;

    // Validate stock input
    if (stock === undefined || stock === null || isNaN(stock) || stock < 0) {
      return NextResponse.json(
        { error: 'Invalid stock value. Must be a non-negative number.' },
        { status: 400 }
      );
    }

    const newStock = parseInt(stock, 10);

    // Get previous stock value
    const previous = await db.product.findUnique({
      where: { id },
      select: { id: true, stock: true },
    });

    if (!previous) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Update only the stock field
    const product = await db.product.update({
      where: { id },
      data: { stock: newStock },
    });

    // Trigger stock alerts if product transitions from out-of-stock to available
    if (previous.stock === 0 && newStock > 0) {
      try {
        await dispatchStockAlertsForProduct(product.id);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            module: 'admin_products_stock_api',
            action: 'dispatch_stock_alerts',
          },
          extra: {
            productId: product.id,
            previousStock: previous.stock,
            newStock,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        stock: product.stock,
      },
    });
  } catch (error) {
    console.error('Failed to update product stock:', error);
    Sentry.captureException(error, {
      tags: {
        module: 'admin_products_stock_api',
        action: 'patch_stock',
      },
    });
    return NextResponse.json(
      { error: 'Failed to update product stock' },
      { status: 500 }
    );
  }
}
