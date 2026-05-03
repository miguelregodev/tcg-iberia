import { NextRequest, NextResponse } from 'next/server';
import { uploadToSupabaseStorage, getSupabaseAdmin } from '@/lib/supabase-storage';

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

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    const url = await uploadToSupabaseStorage(buffer, fileName);

    return NextResponse.json({ url, success: true });
  } catch (error) {
    console.error('Upload handler error:', error);

    const message = error instanceof Error ? error.message : 'Upload failed';

    // Return error message for debugging in dev. In production, return generic message.
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// Storage check endpoint (GET) - requires admin cookie
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('tcg_admin_auth');
  if (!cookie) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
    const bucket = 'product-images';
    const issues: string[] = [];

    if (!url) issues.push('NEXT_PUBLIC_SUPABASE_URL is not set');
    if (!key) issues.push('SUPABASE_SERVICE_ROLE_KEY is not set');

    if (issues.length) {
      return NextResponse.json({ ok: false, issues }, { status: 200 });
    }

    const supabase = getSupabaseAdmin();
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const bucketExists = !!buckets?.some((b) => b.name === bucket);

    return NextResponse.json({
      ok: true,
      supabaseUrl: url,
      bucket,
      bucketExists,
      buckets: buckets?.map((b) => b.name) ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}