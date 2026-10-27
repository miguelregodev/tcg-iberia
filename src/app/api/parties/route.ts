import { NextResponse } from 'next/server';
import { getPublicParty } from '@/lib/parties/public';
import { captureServerError } from '@/lib/observability/sentry';

export async function GET() {
  try {
    const parties = await getPublicParty();
    return NextResponse.json({ parties: parties.filter((party) => party.status === 'OPEN') });
  } catch (error) {
    captureServerError({ error, module: 'parties_public_list_api' });
    return NextResponse.json({ error: 'No se pudieron cargar las Parties.' }, { status: 500 });
  }
}
