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
    
    const hitCard = await db.hitCard.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        imageUrl: body.imageUrl,
        marketPrice: parseFloat(body.marketPrice),
      },
    });

    return NextResponse.json(hitCard);
  } catch (error) {
    console.error('Failed to update hit card:', error);
    return NextResponse.json(
      { error: 'Failed to update hit card' },
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
    const existing = await db.hitCard.findUnique({ where: { id } });
    
    if (existing?.imageUrl) {
      try {
        await deleteFromSupabaseStorage(existing.imageUrl);
      } catch (err) {
        console.warn('Failed to delete image from storage:', err);
      }
    }

    await db.hitCard.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete hit card:', error);
    return NextResponse.json(
      { error: 'Failed to delete hit card' },
      { status: 500 }
    );
  }
}
