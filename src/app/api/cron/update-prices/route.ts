/**
 * GET /api/cron/update-prices
 *
 * Vercel Cron entry point (schedule configured in `vercel.json`, not here).
 * Validates the `Authorization: Bearer <CRON_SECRET>` header and delegates
 * to the shared `runUpdateSupplierPricesUseCase()` — the exact same service
 * invoked by the Admin "Actualizar precios" button. No business logic lives
 * in this route.
 *
 * Response: `SupplierPriceUpdateReport` (see update-supplier-prices.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runUpdateSupplierPricesUseCase } from '@/lib/price-import/update-supplier-prices';

// Prisma requires the Node.js runtime; this route must never be statically cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report = await runUpdateSupplierPricesUseCase();
  return NextResponse.json(report);
}
