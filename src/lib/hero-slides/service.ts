/**
 * Hero slide persistence and business rules.
 * Server-only: imports the Prisma singleton and R2 helpers.
 */
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { downloadFromR2, extractR2KeyFromUrl, getR2PublicUrl } from '@/lib/r2';
import type { HeroSlide, HeroSlideInput, PublicHeroSlide } from '@/types';
import { validateHeroImage } from './image';
import { isPermutationOf, moveToPosition } from './order';

export class HeroSlideNotFoundError extends Error {
  constructor() {
    super('Diapositiva no encontrada.');
    this.name = 'HeroSlideNotFoundError';
  }
}

export class HeroSlideValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeroSlideValidationError';
  }
}

const slideSelect = {
  id: true,
  name: true,
  imageUrl: true,
  destinationUrl: true,
  headline: true,
  buttonLabel: true,
  subtitle: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderBy: Prisma.HeroSlideOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { createdAt: 'asc' }];

type SlideRow = Prisma.HeroSlideGetPayload<{ select: typeof slideSelect }>;

export function serializeHeroSlide(row: SlideRow): HeroSlide {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    destinationUrl: row.destinationUrl,
    headline: row.headline,
    buttonLabel: row.buttonLabel,
    subtitle: row.subtitle,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** All slides (active and inactive) in display order. Admin use only. */
export async function listHeroSlides(): Promise<HeroSlide[]> {
  const rows = await db.heroSlide.findMany({ select: slideSelect, orderBy });
  return rows.map(serializeHeroSlide);
}

/**
 * Active slides for the storefront, in display order.
 * Never throws: on failure it logs and returns an empty list so the homepage falls back to the static hero.
 */
export async function getActiveHeroSlides(): Promise<PublicHeroSlide[]> {
  try {
    return await db.heroSlide.findMany({
      where: { isActive: true },
      select: { id: true, imageUrl: true, destinationUrl: true, headline: true, buttonLabel: true, subtitle: true },
      orderBy,
    });
  } catch (error) {
    console.error('Hero slides query failed:', error);
    captureServerError({ error, module: 'hero_slides_public' });
    return [];
  }
}

/** Rewrites sortOrder only for rows whose position changed, so the result is 0..n-1. */
async function renumber(
  tx: Prisma.TransactionClient,
  currentRows: ReadonlyArray<{ id: string; sortOrder: number }>,
  orderedIds: readonly string[]
): Promise<void> {
  const currentOrder = new Map(currentRows.map((row) => [row.id, row.sortOrder]));
  for (let index = 0; index < orderedIds.length; index++) {
    const id = orderedIds[index];
    if (currentOrder.get(id) !== index) {
      await tx.heroSlide.update({ where: { id }, data: { sortOrder: index } });
    }
  }
}

/** Moves one slide to `position` and renumbers the whole list. Must run inside a transaction. */
async function placeSlide(tx: Prisma.TransactionClient, id: string, position?: number): Promise<void> {
  const rows = await tx.heroSlide.findMany({ select: { id: true, sortOrder: true }, orderBy });
  const orderedIds = moveToPosition(
    rows.map((row) => row.id),
    id,
    position
  );
  await renumber(tx, rows, orderedIds);
}

/**
 * Confirms the image is an object in our R2 bucket and passes the hero image rules.
 * Downloads the object, so only call on create or when the image URL changes.
 */
async function assertStoredHeroImage(imageUrl: string): Promise<void> {
  const key = extractR2KeyFromUrl(imageUrl);
  if (!key || getR2PublicUrl(key) !== imageUrl) {
    throw new HeroSlideValidationError('La imagen debe estar alojada en el almacenamiento del sitio.');
  }

  let buffer: Buffer;
  try {
    buffer = await downloadFromR2(decodeURIComponent(key));
  } catch (error) {
    captureServerError({ error, module: 'hero_slides_image_check' });
    throw new HeroSlideValidationError('No se pudo leer la imagen en el almacenamiento.');
  }

  const result = validateHeroImage(buffer);
  if (!result.ok) {
    throw new HeroSlideValidationError(result.error);
  }
}

/** Creates a slide. Appends at the end unless `sortOrder` is provided. */
export async function createHeroSlide(input: HeroSlideInput): Promise<HeroSlide> {
  await assertStoredHeroImage(input.imageUrl);

  const row = await db.$transaction(async (tx) => {
    const count = await tx.heroSlide.count();
    const created = await tx.heroSlide.create({
      data: {
        name: input.name,
        imageUrl: input.imageUrl,
        destinationUrl: input.destinationUrl,
        headline: input.headline ?? null,
        buttonLabel: input.buttonLabel ?? null,
        subtitle: input.subtitle ?? null,
        isActive: input.isActive,
        sortOrder: count,
      },
      select: { id: true },
    });
    if (input.sortOrder !== undefined) {
      await placeSlide(tx, created.id, input.sortOrder);
    }
    return tx.heroSlide.findUniqueOrThrow({ where: { id: created.id }, select: slideSelect });
  });

  return serializeHeroSlide(row);
}

/** Updates fields. A `sortOrder` change moves the slide and renumbers the list. */
export async function updateHeroSlide(
  id: string,
  patch: Partial<HeroSlideInput>
): Promise<HeroSlide> {
  const existing = await db.heroSlide.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!existing) throw new HeroSlideNotFoundError();

  if (patch.imageUrl !== undefined && patch.imageUrl !== existing.imageUrl) {
    await assertStoredHeroImage(patch.imageUrl);
  }

  const { sortOrder, ...data } = patch;

  const row = await db.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.heroSlide.update({ where: { id }, data });
    }
    if (sortOrder !== undefined) {
      await placeSlide(tx, id, sortOrder);
    }
    return tx.heroSlide.findUniqueOrThrow({ where: { id }, select: slideSelect });
  });

  return serializeHeroSlide(row);
}

/**
 * Deletes a slide row and renumbers the rest.
 * The R2 image is intentionally kept so it stays available in the media library.
 */
export async function deleteHeroSlide(id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const exists = await tx.heroSlide.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new HeroSlideNotFoundError();

    await tx.heroSlide.delete({ where: { id } });
    const rows = await tx.heroSlide.findMany({ select: { id: true, sortOrder: true }, orderBy });
    await renumber(
      tx,
      rows,
      rows.map((row) => row.id)
    );
  });
}

/** Applies a full new order. `ids` must contain every slide exactly once. */
export async function reorderHeroSlides(ids: string[]): Promise<HeroSlide[]> {
  await db.$transaction(async (tx) => {
    const rows = await tx.heroSlide.findMany({ select: { id: true, sortOrder: true }, orderBy });
    if (!isPermutationOf(rows.map((row) => row.id), ids)) {
      throw new HeroSlideValidationError('El orden debe incluir cada diapositiva exactamente una vez.');
    }
    await renumber(tx, rows, ids);
  });
  return listHeroSlides();
}
