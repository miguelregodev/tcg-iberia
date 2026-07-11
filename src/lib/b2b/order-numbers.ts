/**
 * Sequential number generators for B2B orders and invoices.
 *
 * Order numbers  → `PED-YYYY-NNNNNN`  (e.g. PED-2026-000042)
 * Invoice numbers → `FAC-YYYY-NNNNNN` (e.g. FAC-2026-000007)
 *
 * Both counters live in the shared `Sequence` table (rows `B2B_ORDER` and
 * `B2B_INVOICE`, seeded by the migration). Using `update` with `increment`
 * gives us an atomic read-modify-write which is safe against concurrent
 * order submissions.
 *
 * Legal note: Spanish AEAT rules require invoice numbers to be strictly
 * sequential without gaps. Once a number is handed out it MUST land on an
 * emitted invoice — callers must therefore only pull the next invoice
 * number inside the same transaction that persists the acceptance.
 */

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

/** Prisma transaction client type (works both inside and outside `$transaction`). */
type TxClient = Prisma.TransactionClient | typeof db;

async function nextValue(name: string, tx: TxClient = db): Promise<number> {
  const row = await tx.sequence.update({
    where: { name },
    data: { value: { increment: 1 } },
    select: { value: true },
  });
  return row.value;
}

/**
 * Return the next order number, formatted as `PED-YYYY-NNNNNN`.
 * Pass a transaction client when generating the number inside a larger
 * write so the counter increment rolls back with the rest of the changes.
 */
export async function generateB2bOrderNumber(tx: TxClient = db): Promise<string> {
  const seq = await nextValue('B2B_ORDER', tx);
  return `PED-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}

/**
 * Return the next invoice number, formatted as `FAC-YYYY-NNNNNN`.
 * MUST be called inside the same transaction that flips the order to
 * ACCEPTED / persists the invoice — never pull a number without emitting
 * the invoice, or the sequence will contain gaps (forbidden by AEAT).
 */
export async function generateB2bInvoiceNumber(tx: TxClient = db): Promise<string> {
  const seq = await nextValue('B2B_INVOICE', tx);
  return `FAC-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}
