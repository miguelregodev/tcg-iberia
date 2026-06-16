import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { syncCart, CartItemSnapshot } from '@/lib/abandoned-cart/tracker';
import { captureServerError } from '@/lib/observability/sentry';

interface ActivityBody {
  sessionKey: string;
  items: CartItemSnapshot[];
  totalAmount: number;
  guestEmail?: string | null;
}

function isValidSessionKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActivityBody;
    const { sessionKey, items, totalAmount, guestEmail } = body;

    if (!isValidSessionKey(sessionKey)) {
      return NextResponse.json({ error: 'Invalid sessionKey' }, { status: 400 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;

    await syncCart({ sessionKey, userId, guestEmail, items, totalAmount });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    captureServerError({ error: err, module: 'cart_activity' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
