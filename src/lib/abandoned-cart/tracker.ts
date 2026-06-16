import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export interface CartItemSnapshot {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number | null;
  imageUrl?: string | null;
}

export interface CartSyncPayload {
  sessionKey: string;
  userId?: string | null;
  guestEmail?: string | null;
  items: CartItemSnapshot[];
  totalAmount: number;
}

/**
 * Upserts the abandoned cart record for a given sessionKey.
 * An empty cart clears the active record (marks it COMPLETED).
 */
export async function syncCart(payload: CartSyncPayload): Promise<void> {
  const { sessionKey, userId, guestEmail, items, totalAmount } = payload;

  if (items.length === 0) {
    await db.abandonedCart.updateMany({
      where: { sessionKey, status: 'ACTIVE' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return;
  }

  const data = {
    items: items as unknown as Prisma.InputJsonValue,
    totalAmount: String(totalAmount),
    lastActivityAt: new Date(),
    status: 'ACTIVE' as const,
  };

  await db.abandonedCart.upsert({
    where: { sessionKey },
    create: {
      sessionKey,
      userId: userId ?? null,
      guestEmail: guestEmail ? guestEmail.toLowerCase() : null,
      ...data,
    },
    update: {
      ...(userId ? { userId } : {}),
      ...(guestEmail ? { guestEmail: guestEmail.toLowerCase() } : {}),
      ...data,
    },
  });
}

/**
 * Associates a guest email with an existing ACTIVE cart.
 * Called when the user types their email in the checkout form.
 */
export async function associateGuestEmail(
  sessionKey: string,
  email: string,
): Promise<void> {
  await db.abandonedCart.updateMany({
    where: { sessionKey, status: 'ACTIVE' },
    data: { guestEmail: email.toLowerCase() },
  });
}

/**
 * Links a Stripe checkout session to the cart so the webhook can mark it
 * as COMPLETED on successful payment.
 */
export async function linkStripeSession(
  sessionKey: string,
  stripeSessionId: string,
): Promise<void> {
  await db.abandonedCart.updateMany({
    where: { sessionKey, status: 'ACTIVE' },
    data: { stripeSessionId },
  });
}

/**
 * Marks the cart as COMPLETED when the Stripe payment succeeds.
 * Called from the Stripe webhook.
 */
export async function markCartCompletedByStripeSession(
  stripeSessionId: string,
): Promise<void> {
  await db.abandonedCart.updateMany({
    where: { stripeSessionId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}

/**
 * Validates a recovery token and returns the cart if valid and unexpired.
 * Returns null when the token is invalid, expired, or already used.
 */
export async function getCartByRecoveryToken(token: string) {
  const cart = await db.abandonedCart.findUnique({
    where: { recoveryToken: token },
    select: {
      id: true,
      sessionKey: true,
      status: true,
      items: true,
      totalAmount: true,
      recoveryTokenExpiresAt: true,
    },
  });

  if (!cart) return null;
  if (cart.status === 'COMPLETED') return null;
  if (cart.recoveryTokenExpiresAt && new Date() > cart.recoveryTokenExpiresAt) {
    return null;
  }

  return cart;
}

/**
 * Marks a cart as RECOVERED when the user clicks the recovery link.
 */
export async function markCartRecovered(cartId: string): Promise<void> {
  await db.abandonedCart.update({
    where: { id: cartId },
    data: { status: 'RECOVERED', recoveredAt: new Date() },
  });
}

/**
 * Returns all ACTIVE or RECOVERED (but not COMPLETED) carts for a user.
 * Used by the /mi-cuenta/carritos-pendientes page.
 */
export async function getPendingCartsForUser(userId: string) {
  return db.abandonedCart.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'ABANDONED', 'RECOVERED'] },
    },
    orderBy: { lastActivityAt: 'desc' },
    select: {
      id: true,
      sessionKey: true,
      status: true,
      items: true,
      totalAmount: true,
      lastActivityAt: true,
      recoveryToken: true,
      recoveryTokenExpiresAt: true,
    },
  });
}
