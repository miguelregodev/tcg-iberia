import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPendingCartsForUser } from '@/lib/abandoned-cart/tracker';
import { CartItemSnapshot } from '@/lib/abandoned-cart/tracker';
import { captureServerError } from '@/lib/observability/sentry';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const carts = await getPendingCartsForUser(session.user.id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    const data = carts.map((cart) => {
      const items = (cart.items as unknown as CartItemSnapshot[]) ?? [];
      const productCount = items.reduce((s, i) => s + i.quantity, 0);
      const totalAmount = Number(cart.totalAmount);

      return {
        id: cart.id,
        status: cart.status,
        productCount,
        totalAmount,
        lastActivityAt: cart.lastActivityAt.toISOString(),
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          imageUrl: i.imageUrl ?? null,
        })),
        recoveryUrl:
          cart.recoveryToken &&
          cart.recoveryTokenExpiresAt &&
          new Date() < cart.recoveryTokenExpiresAt
            ? `${appUrl}/cart/recover/${cart.recoveryToken}`
            : null,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    captureServerError({ error: err, module: 'user_pending_carts' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
