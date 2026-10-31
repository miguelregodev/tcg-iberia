import { NextRequest, NextResponse } from 'next/server';
import { 
  getImageDetails, 
  assignImageToProduct, 
  removeImageAssignment, 
  deleteImage 
} from '@/lib/media-library';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const image = await getImageDetails(id);

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error('Image details error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get image details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await deleteImage(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, productId } = body;

    if (action === 'assign' && productId) {
      const result = await assignImageToProduct(id, productId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'remove-assignment' && productId) {
      const result = await removeImageAssignment(productId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Image action error:', error);
    const message = error instanceof Error ? error.message : 'Failed to perform action';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
