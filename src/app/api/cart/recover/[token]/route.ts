import { NextRequest, NextResponse } from 'next/server';
import { getCartByRecoveryToken, markCartRecovered } from '@/lib/abandoned-cart/tracker';
import { captureServerError } from '@/lib/observability/sentry';
import { CartItemSnapshot } from '@/lib/abandoned-cart/tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    if (!token || typeof token !== 'string' || token.length !== 64) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const cart = await getCartByRecoveryToken(token);
    if (!cart) {
      return NextResponse.json({ error: 'Token expired or invalid' }, { status: 404 });
    }

    await markCartRecovered(cart.id);

    return NextResponse.json({
      sessionKey: cart.sessionKey,
      items: cart.items as unknown as CartItemSnapshot[],
      totalAmount: Number(cart.totalAmount),
    });
  } catch (err) {
    captureServerError({ error: err, module: 'cart_recover_token', request });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
