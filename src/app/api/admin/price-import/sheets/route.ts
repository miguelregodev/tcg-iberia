/**
 * POST /api/admin/price-import/sheets
 *
 * Fetches and parses a publicly shared Google Sheets document, then performs
 * automatic product matching for each imported row.
 *
 * Matching priority:
 *   1. Manual mapping saved in the PriceMapping table (importedName → productId).
 *   2. Fuzzy match against the full product catalog using Jaro-Winkler + token overlap.
 *   3. No match → returned with matchedProductId: null so the admin can assign manually.
 *
 * Body:   { url: string }
 * Response: { items: ImportedRow[] }
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetData } from '@/lib/price-import/sheets';
import { findBestMatch } from '@/lib/price-import/matcher';

export interface ImportedRow {
  importedName: string;
  jpyPrice: number;
  correspondingRightJpyPrice: number | null;
  sourceRow: number;
  sourceGroup: 'left' | 'right';
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchScore: number | null;
  matchSource: 'manual' | 'fuzzy' | null;
}

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return NextResponse.json({ error: 'El campo "url" es obligatorio.' }, { status: 400 });
  }

  // ── Fetch and parse Google Sheets data ───────────────────────────────────
  let sheetItems: Awaited<ReturnType<typeof fetchSheetData>>;
  try {
    sheetItems = await fetchSheetData(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al leer la hoja.';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // ── Load catalog and manual mappings from DB in parallel ─────────────────
  const [products, mappings] = await Promise.all([
    db.product.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.priceMapping.findMany({ select: { importedName: true, productId: true } }),
  ]);

  const mappingLookup = new Map<string, string>(
    mappings.map((m) => [m.importedName.toLowerCase(), m.productId])
  );
  const productLookup = new Map<string, string>(
    products.map((p) => [p.id, p.name])
  );

  // ── Match each imported item ──────────────────────────────────────────────
  const items: ImportedRow[] = sheetItems.map((item) => {
    // 1. Manual mapping (case-insensitive lookup)
    const manualProductId = mappingLookup.get(item.importedName.toLowerCase());
    if (manualProductId) {
      const manualProductName = productLookup.get(manualProductId) ?? null;
      return {
        ...item,
        matchedProductId: manualProductId,
        matchedProductName: manualProductName,
        matchScore: 1.0,
        matchSource: 'manual' as const,
      };
    }

    // 2. Fuzzy match
    const match = findBestMatch(item.importedName, products);
    if (match) {
      return {
        ...item,
        matchedProductId: match.productId,
        matchedProductName: match.productName,
        matchScore: Math.round(match.score * 100) / 100,
        matchSource: 'fuzzy' as const,
      };
    }

    // 3. No match
    return {
      ...item,
      matchedProductId: null,
      matchedProductName: null,
      matchScore: null,
      matchSource: null,
    };
  });

  return NextResponse.json({ items });
}
