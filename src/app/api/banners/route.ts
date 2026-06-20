import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/banners
 * Returns all enabled announcement banners ordered by displayOrder asc.
 * Public endpoint — no authentication required.
 */
export async function GET() {
  try {
    const banners = await db.announcementBanner.findMany({
      where: { enabled: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        text: true,
        enabled: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(banners, {
      headers: {
        // Allow caching for 30s to reduce DB load; revalidated on demand by admin mutations
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
  }
}
