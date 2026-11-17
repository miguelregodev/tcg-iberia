import { NextRequest, NextResponse } from 'next/server';
import { listR2Objects } from '@/lib/r2';

const IMAGE_KEY_PATTERN = /\.(jpe?g|png|webp|gif|avif)$/i;

// Lists one page of image objects from R2. Non-image keys are dropped, so a page can hold fewer than 100 items.
export async function GET(request: NextRequest) {
  if (!request.cookies.get('tcg_admin_auth')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = new URL(request.url).searchParams.get('continuationToken') ?? undefined;
    const page = await listR2Objects(undefined, token, 100);

    const images = page.objects
      .filter((object) => IMAGE_KEY_PATTERN.test(object.key))
      .map((object) => ({
        key: object.key,
        filename: object.filename,
        publicUrl: object.publicUrl,
        size: object.size,
        createdAt: object.createdAt.toISOString(),
      }));

    return NextResponse.json({ images, continuationToken: page.continuationToken ?? null });
  } catch (error) {
    console.error('R2 image library list error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list images';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
