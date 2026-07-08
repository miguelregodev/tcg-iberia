/**
 * POST /api/admin/price-import/history
 *
 * Records the imported purchase prices (converted JPY → EUR, pre-margin) as
 * historical data points. Same-day imports upsert the existing row so the
 * "last import of the day wins".
 *
 * Body:
 *   {
 *     exchangeRate: number,
 *     entries: [
 *       { catalogProductId?: string | null, variant: 'SHRINK' | 'NO_SHRINK',
 *         sheetProductName: string, priceJpy: number }
 *     ]
 *   }
 *
 * Response:
 *   {
 *     results: [
 *       { key, sheetProductName, catalogProductId, variant, purchasePriceEur,
 *         isHistoricalMin, historicalMinEur }
 *     ]
 *   }
 *
 * The response includes `isHistoricalMin` so the client can render the star
 * icon in the price import table without issuing a follow-up request.
 *
 * `key` is `${sheetProductName}:${variant}` so the client can look up the
 * historical-minimum flag by the imported name, whether or not the row has
 * been matched to a catalog product.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductVariant } from '@prisma/client';
import {
  recordPriceHistoryBatch,
  type RecordHistoryEntry,
} from '@/lib/price-import/history';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

function isValidVariant(v: unknown): v is ProductVariant {
  return v === 'SHRINK' || v === 'NO_SHRINK';
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { exchangeRate?: unknown; entries?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const rate =
    typeof body.exchangeRate === 'number' ? body.exchangeRate : parseFloat(String(body.exchangeRate));
  if (!isFinite(rate) || rate <= 0) {
    return NextResponse.json(
      { error: '"exchangeRate" debe ser un número positivo.' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: '"entries" debe ser un array.' }, { status: 400 });
  }

  // ── Validate + normalize each entry ───────────────────────────────────────
  const entries: RecordHistoryEntry[] = [];
  for (const raw of body.entries) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;

    // catalogProductId is now optional — unmatched imports still record history.
    const rawId = e.catalogProductId;
    const catalogProductId =
      typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : null;
    const variant = e.variant;
    const sheetProductName = typeof e.sheetProductName === 'string' ? e.sheetProductName.trim() : '';
    const priceJpy = typeof e.priceJpy === 'number' ? e.priceJpy : parseFloat(String(e.priceJpy));

    if (!sheetProductName) continue;
    if (!isValidVariant(variant)) continue;
    if (!isFinite(priceJpy) || priceJpy <= 0) continue;

    entries.push({ catalogProductId, variant, sheetProductName, priceJpy });
  }

  if (entries.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await recordPriceHistoryBatch(entries, rate);
    return NextResponse.json({ results });
  } catch (err) {
    // Foreign-key violations here would indicate a stale/deleted product ID
    // arriving from the client. Surface a generic error to avoid leaking DB details.
    const message =
      err instanceof Error && err.message ? err.message : 'No se pudo guardar el histórico de precios.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
