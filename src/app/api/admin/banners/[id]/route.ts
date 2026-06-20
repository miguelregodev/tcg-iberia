import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/banners/[id]
 * Updates an existing announcement banner.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    const text = typeof body.text === 'string' ? body.text.trim() : undefined;
    if (text !== undefined && text.length === 0) {
      return NextResponse.json({ error: 'text cannot be empty' }, { status: 400 });
    }
    if (text !== undefined && text.length > 500) {
      return NextResponse.json({ error: 'text must be 500 characters or fewer' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (text !== undefined) data.text = text;
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.displayOrder === 'number') data.displayOrder = body.displayOrder;

    const banner = await db.announcementBanner.update({
      where: { id },
      data,
    });

    return NextResponse.json(banner);
  } catch {
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/banners/[id]
 * Deletes an announcement banner.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await db.announcementBanner.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 });
  }
}
