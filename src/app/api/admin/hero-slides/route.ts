import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { UNAUTHORIZED_RESPONSE, heroSlideErrorResponse } from '@/lib/hero-slides/http';
import { parseHeroSlideInput, parseReorderInput } from '@/lib/hero-slides/input';
import { createHeroSlide, listHeroSlides, reorderHeroSlides } from '@/lib/hero-slides/service';

const MODULE = 'hero_slides_api';

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }
  try {
    const slides = await listHeroSlides();
    return NextResponse.json(slides);
  } catch (error) {
    return heroSlideErrorResponse(error, MODULE, request);
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON no válido.' }, { status: 400 });
  }

  const parsed = parseHeroSlideInput(body, { partial: false });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const slide = await createHeroSlide({
      name: parsed.value.name!,
      imageUrl: parsed.value.imageUrl!,
      destinationUrl: parsed.value.destinationUrl!,
      isActive: parsed.value.isActive ?? true,
      sortOrder: parsed.value.sortOrder,
    });
    revalidatePath('/');
    return NextResponse.json(slide, { status: 201 });
  } catch (error) {
    return heroSlideErrorResponse(error, MODULE, request);
  }
}

/** Reorder: body `{ ids: string[] }` containing every slide id exactly once. */
export async function PATCH(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON no válido.' }, { status: 400 });
  }

  const parsed = parseReorderInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const slides = await reorderHeroSlides(parsed.value);
    revalidatePath('/');
    return NextResponse.json(slides);
  } catch (error) {
    return heroSlideErrorResponse(error, MODULE, request);
  }
}
