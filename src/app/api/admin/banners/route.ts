import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

/**
 * GET /api/admin/banners
 * Returns all announcement banners (enabled and disabled) for admin management.
 */
export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const banners = await db.announcementBanner.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return NextResponse.json(banners);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
  }
}

/**
 * POST /api/admin/banners
 * Creates a new announcement banner.
 * Body: { text: string; enabled: boolean; displayOrder: number }
 */
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: 'text must be 500 characters or fewer' }, { status: 400 });
    }

    const banner = await db.announcementBanner.create({
      data: {
        text,
        enabled: body.enabled ?? true,
        displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : 0,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/banners
 * Reorders banners in bulk.
 * Body: { ids: string[] } — ordered array of banner IDs representing the new displayOrder.
 */
export async function PATCH(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body.ids) || body.ids.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'ids must be an array of strings' }, { status: 400 });
    }

    const updates = (body.ids as string[]).map((id, index) =>
      db.announcementBanner.update({
        where: { id },
        data: { displayOrder: index },
      })
    );

    await db.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to reorder banners' }, { status: 500 });
  }
}
