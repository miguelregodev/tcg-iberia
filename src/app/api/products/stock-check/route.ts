/**
 * POST /api/products/stock-check
 *
 * Re-validates current stock/availability for a list of product ids. Used by the
 * checkout page to catch products that went out of stock (or were unpublished)
 * since they were added to the cart, which can sit in localStorage for a long time.
 *
 * Also returns current pricing so the cart can pick up discounts activated after
 * a product was added.
 *
 * Request body: { productIds: string[] }
 * Response: { data: { id: string; stock: number; canPurchase: boolean;
 *   price: number; liveOpeningPrice: number | null; discountPercentage: number | null }[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { getProductInventoryState } from '@/lib/products/state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIds: unknown[] | null = Array.isArray(body?.productIds) ? body.productIds : null;

    if (!rawIds) {
      return NextResponse.json({ error: 'productIds is required' }, { status: 400 });
    }

    const productIds: string[] = Array.from(
      new Set(rawIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))
    );

    if (productIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        stock: true,
        releaseDate: true,
        visible: true,
        price: true,
        liveOpeningPrice: true,
        discountPercentage: true,
      },
    });

    const data = productIds.map((id) => {
      const product = products.find((p) => p.id === id);
      // Missing or unpublished products are treated as unavailable for purchase.
      if (!product || !product.visible) {
        return {
          id,
          stock: 0,
          canPurchase: false,
          price: 0,
          liveOpeningPrice: null,
          discountPercentage: null,
        };
      }
      const state = getProductInventoryState({
        stock: product.stock,
        releaseDate: product.releaseDate,
      });
      return {
        id,
        stock: state.stock,
        canPurchase: state.canPurchase,
        price: parseFloat(product.price.toString()),
        liveOpeningPrice:
          product.liveOpeningPrice != null ? parseFloat(product.liveOpeningPrice.toString()) : null,
        discountPercentage:
          product.discountPercentage != null ? parseFloat(product.discountPercentage.toString()) : null,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('POST /api/products/stock-check error', error);
    captureServerError({
      error,
      module: 'products_api',
      request,
    });
    return NextResponse.json({ error: 'Failed to check stock' }, { status: 500 });
  }
}
