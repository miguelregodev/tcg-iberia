import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { captureServerEvent } from '@/lib/analytics/posthog-server';

// POST /api/user/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, password, phone, addressLine, postalCode, city, locality, province } = body;

    // ── Server-side validation ────────────────────────────────────────────────
    if (!fullName || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'La contraseña debe tener mínimo 8 caracteres, con al menos una letra y un número.' },
        { status: 400 },
      );
    }

    // ── Uniqueness check ──────────────────────────────────────────────────────
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese correo electrónico.' },
        { status: 409 },
      );
    }

    // ── Hash password ─────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Create user ───────────────────────────────────────────────────────────
    const user = await db.user.create({
      data: {
        fullName,
        email: email.toLowerCase(),
        passwordHash,
        phone: phone ?? null,
        addressLine: addressLine ?? null,
        postalCode: postalCode ?? null,
        city: city ?? null,
        locality: locality ?? null,
        province: province ?? null,
      },
    });

    // ── Analytics ─────────────────────────────────────────────────────────────
    captureServerEvent(user.id, 'user_registered', { method: 'email' });

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'api', route: 'user/register' } });
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
