import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import {
  HERO_IMAGE_EXTENSION,
  HERO_IMAGE_MAX_BYTES,
  HERO_IMAGE_MIME,
  validateHeroImage,
} from '@/lib/hero-slides/image';
import { UNAUTHORIZED_RESPONSE } from '@/lib/hero-slides/http';
import { captureServerError } from '@/lib/observability/sentry';
import { uploadToR2 } from '@/lib/r2';

/**
 * Uploads a hero image to R2 after validation.
 * Keys use the products/ prefix so the image also appears in the media library.
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  let file: File | null;
  try {
    const formData = await request.formData();
    const value = formData.get('file');
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: 'Se requiere un archivo válido.' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'Se requiere un archivo.' }, { status: 400 });
  }
  if (file.size > HERO_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen supera el tamaño máximo de 5 MB.' }, { status: 400 });
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = validateHeroImage(buffer);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const key = `products/hero-${Date.now()}-${randomUUID()}.${HERO_IMAGE_EXTENSION[result.format]}`;
    const uploaded = await uploadToR2(key, buffer, HERO_IMAGE_MIME[result.format]);

    return NextResponse.json(
      {
        url: uploaded.publicUrl,
        key,
        width: result.width,
        height: result.height,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Hero image upload error:', error);
    captureServerError({ error, module: 'hero_slides_image_upload', request });
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
  }
}
