import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.productId || !body.name || !body.type || !body.imageUrl || body.marketPrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const hitCard = await db.hitCard.create({
      data: {
        productId: body.productId,
        name: body.name,
        type: body.type,
        imageUrl: body.imageUrl,
        marketPrice: parseFloat(body.marketPrice),
      },
    });

    return NextResponse.json(hitCard);
  } catch (error) {
    console.error('Failed to create hit card:', error);
    return NextResponse.json(
      { error: 'Failed to create hit card' },
      { status: 500 }
    );
  }
}
