import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';
import {
  LIVE_SEARCH_LIMIT,
  parseSearchLimit,
  parseSearchOffset,
  rankSearchMatches,
  SEARCH_MIN_QUERY_LENGTH,
  tokenize,
} from '@/lib/products/search';

/**
 * GET /api/search
 *
 * Query params:
 * - `q`       — raw user query (required for any match)
 * - `limit`   — max products to return (default `LIVE_SEARCH_LIMIT`, capped at 100)
 * - `offset`  — pagination offset (default 0)
 *
 * Response shape: `SearchResponse` (see `@/lib/products/search`).
 *
 * Matching rules (handled by `@/lib/products/search`):
 * - Case- and diacritic-insensitive.
 * - Tokenised: every token must appear somewhere in name/type/description.
 * - Ranked by product priority (ASC) → relevance score → name.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const rawQuery = params.get('q') ?? '';
    const limit = parseSearchLimit(params.get('limit'), LIVE_SEARCH_LIMIT);
    const offset = parseSearchOffset(params.get('offset'));

    const tokens = tokenize(rawQuery);

    if (tokens.length === 0 || rawQuery.trim().length < SEARCH_MIN_QUERY_LENGTH) {
      return NextResponse.json({
        products: [],
        total: 0,
        limit,
        offset,
        tokens,
      });
    }

    // Build a tokenised AND/OR Prisma where clause. Each token must appear
    // in at least one searchable field — we let Postgres do the
    // case-insensitive substring search via `mode: 'insensitive'`.
    // We intentionally do **not** rely on Postgres for diacritic folding;
    // diacritics are handled at the relevance-ranking stage, which still
    // catches things like "japones" matching "Japonés Booster Box" when the
    // user types without accents, because most product names in the catalog
    // are stored without diacritics. (Adding pg_trgm/unaccent is a future
    // optimisation that is out of scope here.)
    const where: Prisma.ProductWhereInput = {
      visible: true,
      AND: tokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: 'insensitive' as const } },
          { type: { contains: token, mode: 'insensitive' as const } },
          { description: { contains: token, mode: 'insensitive' as const } },
        ],
      })),
    };

    // We need the full match set in memory to rank by relevance, but the
    // DB still narrows it down for us via the tokenised AND clause. For a
    // catalog of this scale (low thousands max) this is the simplest robust
    // approach. If the table grows large, swap this for a Postgres FTS query.
    const matches = await db.product.findMany({
      where,
      select: publicProductSelect,
      orderBy: { priority: 'asc' },
    });

    const ranked = rankSearchMatches(matches, tokens);
    const paged = ranked.slice(offset, offset + limit);

    const products = paged.map(({ __searchScore: _ignored, ...rest }) =>
      serializePublicProduct(rest),
    );

    return NextResponse.json({
      products,
      total: ranked.length,
      limit,
      offset,
      tokens,
    });
  } catch (error) {
    console.error('GET /api/search error', error);
    captureServerError({
      error,
      module: 'search_api',
      request,
    });
    return NextResponse.json(
      { error: 'Failed to run search' },
      { status: 500 },
    );
  }
}
