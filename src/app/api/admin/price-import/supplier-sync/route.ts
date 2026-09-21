/**
 * POST /api/admin/price-import/supplier-sync
 *
 * Thin orchestration layer for the Admin "Actualizar precios" button.
 * Contains NO business logic — it only checks admin auth and delegates to
 * the shared `runUpdateSupplierPricesUseCase()`, the exact same service used
 * by the Vercel Cron endpoint (`/api/cron/update-prices`).
 *
 * Response: `SupplierPriceUpdateReport` (see update-supplier-prices.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runUpdateSupplierPricesUseCase } from '@/lib/price-import/update-supplier-prices';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report = await runUpdateSupplierPricesUseCase();
  return NextResponse.json(report);
}
