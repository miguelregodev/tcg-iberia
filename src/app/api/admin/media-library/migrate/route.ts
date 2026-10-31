import { NextRequest, NextResponse } from 'next/server';
import { migrateImageToR2, migrateBulkToR2, getMigrationHistory, getMigrationStatistics } from '@/lib/image-migration';

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
    const { imageUrl, imageUrls, action } = body;

    if (action === 'migrate-single' && imageUrl) {
      const result = await migrateImageToR2(imageUrl);
      return NextResponse.json(result);
    }

    if (action === 'migrate-bulk' && Array.isArray(imageUrls)) {
      const result = await migrateBulkToR2(imageUrls, 3);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Migration error:', error);
    const message = error instanceof Error ? error.message : 'Migration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (type === 'history') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const history = getMigrationHistory(limit);
      return NextResponse.json({ success: true, history });
    }

    if (type === 'statistics') {
      const stats = getMigrationStatistics();
      return NextResponse.json({ success: true, statistics: stats });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Migration info error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get migration info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
