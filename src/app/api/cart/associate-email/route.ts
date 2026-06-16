import { NextRequest, NextResponse } from 'next/server';
import { associateGuestEmail } from '@/lib/abandoned-cart/tracker';
import { captureServerError } from '@/lib/observability/sentry';

interface Body {
  sessionKey: string;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const { sessionKey, email } = body;

    if (typeof sessionKey !== 'string' || !sessionKey) {
      return NextResponse.json({ error: 'Invalid sessionKey' }, { status: 400 });
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    await associateGuestEmail(sessionKey, email);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    captureServerError({ error: err, module: 'cart_associate_email' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
