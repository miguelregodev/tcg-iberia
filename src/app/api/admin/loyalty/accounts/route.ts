import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getLoyaltyAdministrator } from '@/lib/loyalty/admin';
import { listLoyaltyAccounts } from '@/lib/loyalty/admin-accounts';
import { isLoyaltyLocalPreview } from '@/lib/loyalty/local-preview';
import { captureServerError } from '@/lib/observability/sentry';

const PAGE_SIZES = new Set([25, 50, 100]);

export async function GET(request: NextRequest) {
  if (!isLoyaltyLocalPreview()) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  if (!getLoyaltyAdministrator(request)) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '25');
  const query = (params.get('q') ?? '').slice(0, 255);
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !PAGE_SIZES.has(pageSize)) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  try {
    const result = await listLoyaltyAccounts(db, { query, page, pageSize, now: new Date() });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    captureServerError({ error, module: 'loyalty_admin_accounts', request });
    return NextResponse.json({ error: 'No se pudieron cargar los clientes.' }, { status: 500 });
  }
}
