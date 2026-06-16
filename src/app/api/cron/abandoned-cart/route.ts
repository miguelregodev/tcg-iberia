import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRecoveryToken } from '@/lib/abandoned-cart/token';
import { sendCartRecoveryEmail, CartRecoveryItem } from '@/lib/email';
import { captureServerError } from '@/lib/observability/sentry';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { CartItemSnapshot } from '@/lib/abandoned-cart/tracker';
import { Prisma } from '@prisma/client';

const ABANDONED_DELAY_HOURS = Number(process.env.ABANDONED_CART_DELAY_HOURS ?? 24);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${CRON_SECRET}`;
}

function cartTotal(items: CartItemSnapshot[]): number {
  return items.reduce((sum, item) => {
    const unit = item.price * (1 - (item.discountPercentage ?? 0) / 100);
    return sum + unit * item.quantity;
  }, 0);
}

export async function GET(request: NextRequest) {
  // Only allow invocations with the cron secret (Vercel or manual).
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ABANDONED_DELAY_HOURS * 60 * 60 * 1000);

  try {
    // Find all ACTIVE carts whose last activity is older than the delay.
    // We process in batches of 100 to avoid query timeouts.
    const carts = await db.abandonedCart.findMany({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { lt: cutoff },
        // Only process carts that haven't had a recovery email sent.
        recoveryEmailStatus: 'NONE',
      },
      take: 100,
      select: {
        id: true,
        sessionKey: true,
        userId: true,
        guestEmail: true,
        items: true,
        totalAmount: true,
        user: { select: { email: true, fullName: true } },
      },
    });

    let processed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const cart of carts) {
      const rawItems = cart.items as unknown as CartItemSnapshot[];
      const items = Array.isArray(rawItems) ? rawItems : [];
      const value = Number(cart.totalAmount);

      // Determine the recipient email and name.
      const recipientEmail = cart.user?.email ?? cart.guestEmail;
      const recipientName = cart.user?.fullName?.split(' ')[0] ?? undefined;

      // Always mark as ABANDONED and fire analytics.
      const { token, expiresAt } = generateRecoveryToken();

      try {
        // Atomic status update — prevents duplicate emails via unique token.
        await db.abandonedCart.update({
          where: {
            id: cart.id,
            recoveryEmailStatus: 'NONE', // guard against race conditions
          },
          data: {
            status: 'ABANDONED',
            recoveryToken: token,
            recoveryTokenExpiresAt: expiresAt,
            recoveryEmailStatus: recipientEmail ? 'SENT' : 'NONE',
            recoveryEmailSentAt: recipientEmail ? new Date() : null,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025'
        ) {
          // Cart was already processed by another cron run — skip safely.
          continue;
        }
        throw err;
      }

      // Track cart_abandoned in PostHog.
      await captureServerEvent(
        cart.userId ?? cart.guestEmail ?? cart.sessionKey,
        'cart_abandoned',
        {
          cartId: cart.id,
          productCount: items.reduce((s, i) => s + i.quantity, 0),
          cartValue: value,
        },
      );

      processed++;

      if (!recipientEmail) continue;

      // Send the recovery email.
      try {
        const recoveryUrl = `${APP_URL}/cart/recover/${token}`;
        const emailItems: CartRecoveryItem[] = items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          discountPercentage: i.discountPercentage,
          imageUrl: i.imageUrl,
        }));

        await sendCartRecoveryEmail({
          to: recipientEmail,
          firstName: recipientName,
          items: emailItems,
          totalAmount: cartTotal(items),
          recoveryUrl,
        });

        await captureServerEvent(
          cart.userId ?? recipientEmail,
          'abandoned_cart_email_sent',
          {
            cartId: cart.id,
            productCount: items.reduce((s, i) => s + i.quantity, 0),
            cartValue: value,
          },
        );

        emailsSent++;
      } catch (emailErr) {
        captureServerError({
          error: emailErr,
          module: 'cron_abandoned_cart_email',
          userEmail: recipientEmail,
        });

        // Revert email status to FAILED so it could be retried if needed.
        await db.abandonedCart.update({
          where: { id: cart.id },
          data: { recoveryEmailStatus: 'FAILED' },
        });

        emailsFailed++;
      }
    }

    return NextResponse.json({ processed, emailsSent, emailsFailed });
  } catch (err) {
    captureServerError({ error: err, module: 'cron_abandoned_cart', request });
    return NextResponse.json({ error: 'Cron execution failed' }, { status: 500 });
  }
}
