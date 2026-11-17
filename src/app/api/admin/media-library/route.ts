import { NextRequest, NextResponse } from 'next/server';
import { getAllImages } from '@/lib/media-library';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider') as 'supabase' | 'r2' | null;
    const search = url.searchParams.get('search');
    const assignedOnly = url.searchParams.get('assignedOnly') === 'true';
    const unassignedOnly = url.searchParams.get('unassignedOnly') === 'true';

    const images = await getAllImages({
      provider: provider || undefined,
      search: search || undefined,
      assignedOnly,
      unassignedOnly,
    });

    return NextResponse.json({
      success: true,
      count: images.length,
      images,
    });
  } catch (error) {
    console.error('Media library list error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list images';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
