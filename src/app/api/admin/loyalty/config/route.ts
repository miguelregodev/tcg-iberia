import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getLoyaltyAdministrator } from '@/lib/loyalty/admin';
import { isLoyaltyCheckoutEnabled, isLoyaltyEnabled, isLoyaltyLocalPreview } from '@/lib/loyalty/local-preview';
import { parseLoyaltyConfig } from '@/lib/loyalty/config';
import { captureServerError } from '@/lib/observability/sentry';

const configInclude = { tiers: { orderBy: { position: 'asc' as const } } };
type ConfigRecord = Prisma.LoyaltyProgramConfigGetPayload<{ include: typeof configInclude }>;

function serializeConfig(config: ConfigRecord) {
  return {
    enabled: config.enabled,
    baseRate: config.baseRate.toString(),
    pointsPerEuro: config.pointsPerEuro.toString(),
    minimumRedemption: config.minimumRedemption.toString(),
    redemptionIncrement: config.redemptionIncrement.toString(),
    maxDiscountPercent: config.maxDiscountPercent.toString(),
    evaluationDays: config.evaluationDays,
    expirationMonths: config.expirationMonths,
    tiers: config.tiers.map((tier) => ({
      name: tier.name,
      threshold: tier.threshold.toString(),
      multiplier: tier.multiplier.toString(),
      description: tier.description,
      color: tier.color,
      icon: tier.icon,
      benefits: tier.benefits,
    })),
  };
}

function availability() {
  return { available: isLoyaltyEnabled(), localPreview: isLoyaltyLocalPreview(), checkout: isLoyaltyCheckoutEnabled() };
}

export async function GET(request: NextRequest) {
  try {
    if (!getLoyaltyAdministrator(request)) {
      return NextResponse.json({ error: 'Se requiere una sesión de backoffice.' }, { status: 403 });
    }
    const config = await db.loyaltyProgramConfig.findUniqueOrThrow({
      where: { id: 'default' },
      include: configInclude,
    });
    return NextResponse.json({ ...serializeConfig(config), ...availability() });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_config_get', request });
    return NextResponse.json({ error: 'No se pudo cargar la configuración.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminActor = getLoyaltyAdministrator(request);
    if (!adminActor) {
      return NextResponse.json({ error: 'Se requiere una sesión de backoffice.' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Configuración inválida.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (typeof input.enabled !== 'boolean' || (input.enabled && !isLoyaltyEnabled())) {
      return NextResponse.json({ error: 'El programa todavía no se puede activar.' }, { status: 400 });
    }
    const enabled = input.enabled;
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 2000) {
      return NextResponse.json({ error: 'Indica el motivo del cambio.' }, { status: 400 });
    }
    const reason = input.reason.trim();

    let config;
    try {
      config = parseLoyaltyConfig(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuración inválida.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LoyaltyProgramConfig" WHERE "id" = 'default' FOR UPDATE`);
      const before = await tx.loyaltyProgramConfig.findUniqueOrThrow({
        where: { id: 'default' },
        include: configInclude,
      });
      if (before.enabled && !isLoyaltyEnabled()) throw new Error('Active loyalty program cannot be edited by this endpoint');
      const { tiers, ...settings } = config;
      await tx.loyaltyTier.deleteMany({ where: { configId: 'default' } });
      await tx.loyaltyProgramConfig.update({ where: { id: 'default' }, data: { ...settings, enabled } });
      await tx.loyaltyTier.createMany({
        data: tiers.map((tier, position) => ({ ...tier, position, configId: 'default' })),
      });
      const after = await tx.loyaltyProgramConfig.findUniqueOrThrow({
        where: { id: 'default' },
        include: configInclude,
      });
      await tx.loyaltyAdminAction.create({
        data: {
          adminActor,
          action: 'CONFIG_UPDATE',
          reason,
          before: serializeConfig(before),
          after: serializeConfig(after),
        },
      });
      return serializeConfig(after);
    });

    return NextResponse.json({ ...updated, ...availability() });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_config_put', request });
    return NextResponse.json({ error: 'No se pudo guardar la configuración.' }, { status: 500 });
  }
}
