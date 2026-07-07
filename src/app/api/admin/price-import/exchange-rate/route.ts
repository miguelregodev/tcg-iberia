/**
 * GET /api/admin/price-import/exchange-rate
 *
 * Returns the current JPY → EUR exchange rate.
 * Responses are cached at the service layer for 1 hour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJpyToEurRate } from '@/lib/price-import/currency';

function isAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rate, source } = await getJpyToEurRate();
    return NextResponse.json({ rate, source });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa de cambio.' },
      { status: 502 }
    );
  }
}
