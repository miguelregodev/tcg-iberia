import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/user/profile — returns the current user's profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        addressLine: true,
        postalCode: true,
        city: true,
        locality: true,
        province: true,
        country: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/profile', method: 'GET' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// PUT /api/user/profile — updates the current user's profile
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, phone, addressLine, postalCode, city, locality, province, country } = body;

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'El nombre completo es obligatorio.' }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        fullName: fullName.trim(),
        phone: phone?.trim() ?? null,
        addressLine: addressLine?.trim() ?? null,
        postalCode: postalCode?.trim() ?? null,
        city: city?.trim() ?? null,
        locality: locality?.trim() ?? null,
        province: province?.trim() ?? null,
        country: country?.trim() ?? 'España',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        addressLine: true,
        postalCode: true,
        city: true,
        locality: true,
        province: true,
        country: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/profile', method: 'PUT' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
