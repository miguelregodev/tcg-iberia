import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { deleteFromSupabaseStorage } from '@/lib/supabase-storage';

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
    const product = await db.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        price: parseFloat(body.price),
        discountPercentage: body.discountPercentage ? parseFloat(body.discountPercentage) : null,
        notes: body.notes || null,
        stock: parseInt(body.stock),
        imageUrl: body.imageUrl,
        visible: body.visible,
      },
    });

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