import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const hitCards = await db.hitCard.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(hitCards);
  } catch (error) {
    console.error('Failed to fetch hit cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hit cards' },
      { status: 500 }
    );
  }
}
