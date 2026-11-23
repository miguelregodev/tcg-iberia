/**
 * Internal audit trail for B2B orders (`B2bOrderEvent`). Events are written
 * inside the same transaction as the state change they describe whenever
 * possible. Audit events are admin-only and never serialized to customers.
 */

import type { B2bOrderEventType, Prisma } from '@prisma/client';
import { db } from '@/lib/db';

type Client = Prisma.TransactionClient | typeof db;

export const SYSTEM_ACTOR = 'system';
export const CUSTOMER_ACTOR = 'customer';

export async function recordB2bOrderEvent(
  client: Client,
  orderId: string,
  type: B2bOrderEventType,
  actor: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await client.b2bOrderEvent.create({
    data: {
      orderId,
      type,
      actor,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

/** Best-effort variant for post-commit side effects (emails, PDF generation). */
export async function recordB2bOrderEventSafe(
  orderId: string,
  type: B2bOrderEventType,
  actor: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await recordB2bOrderEvent(db, orderId, type, actor, metadata);
  } catch (err) {
    console.error(`[b2b/audit] Failed to record ${type} for order ${orderId}:`, err instanceof Error ? err.name : 'unknown');
  }
}
