import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { UNAUTHORIZED_RESPONSE, heroSlideErrorResponse } from '@/lib/hero-slides/http';
import { parseHeroSlideInput } from '@/lib/hero-slides/input';
import { deleteHeroSlide, updateHeroSlide } from '@/lib/hero-slides/service';

const MODULE = 'hero_slides_api';

type RouteContext = { params: Promise<{ id: string }> };

/** Partial update: any subset of fields, including `isActive` toggles and `sortOrder` moves. */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON no válido.' }, { status: 400 });
  }

  const parsed = parseHeroSlideInput(body, { partial: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const slide = await updateHeroSlide(id, parsed.value);
    revalidatePath('/');
    return NextResponse.json(slide);
  } catch (error) {
    return heroSlideErrorResponse(error, MODULE, request);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteHeroSlide(id);
    revalidatePath('/');
    return NextResponse.json({ success: true });
  } catch (error) {
    return heroSlideErrorResponse(error, MODULE, request);
  }
}
