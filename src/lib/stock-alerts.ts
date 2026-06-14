import * as Sentry from '@sentry/nextjs';
import { NotificationStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { sendStockAlertEmail } from '@/lib/email';
import { captureServerEvent } from '@/lib/analytics/posthog-server';

export function extractEmailDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : 'unknown';
}

export async function dispatchStockAlertsForProduct(productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      price: true,
      discountPercentage: true,
      stock: true,
    },
  });

  if (!product || product.stock <= 0) return;

  const pendingAlertIds = await db.stockAlert.findMany({
    where: {
      productId,
      status: NotificationStatus.PENDING,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of pendingAlertIds) {
    // Claim one alert atomically to prevent duplicate sends across concurrent processes.
    const claim = await db.stockAlert.updateMany({
      where: {
        id: row.id,
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.SENDING,
      },
    });

    if (claim.count === 0) {
      // Another process already claimed/sent this alert.
      Sentry.captureMessage('Duplicate stock alert notification attempt skipped', {
        level: 'info',
        tags: {
          module: 'stock_alerts',
          action: 'duplicate_attempt',
        },
        extra: {
          alertId: row.id,
          productId,
        },
      });
      continue;
    }

    const alert = await db.stockAlert.findUnique({
      where: { id: row.id },
      select: {
        id: true,
        email: true,
        userId: true,
      },
    });

    if (!alert) continue;

    try {
      await sendStockAlertEmail({
        to: alert.email,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          imageUrl: product.imageUrl,
          price: Number(product.price),
          discountPercentage: product.discountPercentage
            ? Number(product.discountPercentage)
            : null,
        },
      });

      await db.stockAlert.update({
        where: { id: alert.id },
        data: {
          status: NotificationStatus.SENT,
          notifiedAt: new Date(),
        },
      });

      await captureServerEvent(
        alert.userId ?? alert.email,
        'stock_alert_email_sent',
        {
          productId: product.id,
          productName: product.name,
          userId: alert.userId ?? null,
          emailDomain: extractEmailDomain(alert.email),
        }
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'stock_alerts',
          action: 'send_email',
        },
        extra: {
          alertId: alert.id,
          productId: product.id,
          email: alert.email,
        },
      });

      // Requeue to allow retries on next stock restoration or manual retry flow.
      await db.stockAlert.update({
        where: { id: alert.id },
        data: {
          status: NotificationStatus.PENDING,
        },
      });
    }
  }
}
