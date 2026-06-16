import { db } from '@/lib/db';
import type { CalendarProduct } from '@/types/releases';

/**
 * Fetches all visible products whose releaseDate falls within the given
 * calendar month (UTC boundaries). Returns a lightweight projection
 * containing only the fields needed by the calendar UI.
 */
export async function getReleasesForMonth(
  year: number,
  month: number,
): Promise<CalendarProduct[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1)); // exclusive

  const products = await db.product.findMany({
    where: {
      visible: true,
      releaseDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      discountPercentage: true,
      imageUrl: true,
      releaseDate: true,
      language: true,
    },
    orderBy: [{ releaseDate: 'asc' }, { priority: 'asc' }],
  });

  return products.map((p) => {
    const price = parseFloat(p.price.toString());
    const discountPercentage = p.discountPercentage
      ? parseFloat(p.discountPercentage.toString())
      : null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price,
      discountPercentage,
      imageUrl: p.imageUrl,
      releaseDate: p.releaseDate!.toISOString(),
      language: p.language,
    };
  });
}
