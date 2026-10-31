import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { captureServerError } from '@/lib/observability/sentry';
import { getPartyPricing, isPartyMode, parseMoneyToCents } from '@/lib/parties/core';
import { reconcileVerifiedPartyPayments } from '@/lib/parties/reconcile';

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await reconcileVerifiedPartyPayments();
    const parties = await db.party.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        product: {
          select: { id: true, name: true, slug: true, imageUrl: true, language: true },
        },
        participations: {
          orderBy: { slotNumber: 'asc' },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true } },
          },
        },
        winnerParticipation: {
          select: { id: true, user: { select: { fullName: true, email: true } } },
        },
      },
    });
    return NextResponse.json(
      parties.map((party) => ({
        ...party,
        boxPrice: Number(party.boxPrice),
        participationPrice: Number(party.participationPrice),
        participations: party.participations.map((participation) => ({
          ...participation,
          amountPaid: Number(participation.amountPaid),
        })),
      })),
    );
  } catch (error) {
    captureServerError({ error, module: 'admin_parties_list_api', request });
    return NextResponse.json({ error: 'No se pudieron cargar las Parties.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId?: unknown;
      packsPerBox?: unknown;
      participantCount?: unknown;
      mode?: unknown;
      internalNotes?: unknown;
    };
    if (
      typeof body.productId !== 'string' ||
      !body.productId ||
      !isPartyMode(body.mode) ||
      typeof body.packsPerBox !== 'number' ||
      !Number.isInteger(body.packsPerBox) ||
      typeof body.participantCount !== 'number' ||
      !Number.isInteger(body.participantCount) ||
      (body.internalNotes !== undefined && typeof body.internalNotes !== 'string')
    ) {
      return NextResponse.json({ error: 'Completa todos los campos obligatorios.' }, { status: 400 });
    }
    const productId = body.productId;
    const mode = body.mode;
    const packsPerBox = body.packsPerBox;
    const participantCount = body.participantCount;

    const party = await db.$transaction(async (tx) => {
      const products = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          price: Prisma.Decimal;
          liveOpeningPrice: Prisma.Decimal | null;
          stock: number;
          visible: boolean;
          type: string | null;
        }>
      >(Prisma.sql`
        SELECT "id", "name", "price", "liveOpeningPrice", "stock", "visible", "type"
        FROM "Product"
        WHERE "id" = ${productId}
        FOR UPDATE
      `);
      const product = products[0];
      if (!product || !product.visible || product.type?.trim().toLowerCase() !== 'booster box') {
        throw new Error('PARTY_PRODUCT_NOT_FOUND');
      }
      // Parties are sold as live openings, so that variant's price wins when defined.
      const boxPriceCents = parseMoneyToCents((product.liveOpeningPrice ?? product.price).toString());
      const pricing =
        boxPriceCents === null
          ? null
          : getPartyPricing({
              boxPriceCents,
              packsPerBox,
              participantCount,
            });
      if (!pricing) throw new Error('PARTY_CONFIGURATION_INVALID');

      const reserved = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: 1 } },
        data: { stock: { decrement: 1 } },
      });
      if (reserved.count !== 1) throw new Error('PARTY_INSUFFICIENT_STOCK');

      const created = await tx.party.create({
        data: {
          productId: product.id,
          boxPrice: (pricing.boxPriceCents / 100).toFixed(2),
          packsPerBox,
          participantCount,
          mode,
          packsPerParticipant: pricing.packsPerParticipant,
          participationPrice: (pricing.participationPriceCents / 100).toFixed(2),
          internalNotes:
            typeof body.internalNotes === 'string' && body.internalNotes.trim()
              ? body.internalNotes.trim()
              : null,
          createdByAdminId: 'admin-cookie',
          auditLogs: {
            create: {
              action: 'CREATED',
              details: {
                productId: product.id,
                boxPriceCents: pricing.boxPriceCents,
                participationPriceCents: pricing.participationPriceCents,
                totalRevenueCents: pricing.totalRevenueCents,
                revenueDifferenceCents: pricing.revenueDifferenceCents,
                participantCount,
                mode,
              },
            },
          },
        },
        include: {
          product: {
            select: { id: true, name: true, slug: true, imageUrl: true, language: true },
          },
        },
      });
      return created;
    });

    return NextResponse.json(
      {
        ...party,
        boxPrice: Number(party.boxPrice),
        participationPrice: Number(party.participationPrice),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PARTY_PRODUCT_NOT_FOUND') {
        return NextResponse.json({ error: 'No se encontró el producto seleccionado.' }, { status: 404 });
      }
      if (error.message === 'PARTY_CONFIGURATION_INVALID') {
        return NextResponse.json(
          { error: 'El número de participantes debe dividir exactamente los packs de la caja.' },
          { status: 400 },
        );
      }
      if (error.message === 'PARTY_INSUFFICIENT_STOCK') {
        return NextResponse.json({ error: 'No hay stock disponible para reservar esta caja.' }, { status: 409 });
      }
    }
    captureServerError({ error, module: 'admin_parties_create_api', request });
    return NextResponse.json({ error: 'No se pudo crear la Party.' }, { status: 500 });
  }
}
