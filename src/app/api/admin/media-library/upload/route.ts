import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/media-library';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const provider = (formData.get('provider') as 'supabase' | 'r2') || 'r2';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validMimeTypes = ['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/gif'];
    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: WebP, JPEG, PNG, AVIF, GIF' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (max ${maxSize / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImage(buffer, file.name, file.type, provider);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: file.name,
      provider,
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
