/**
 * Number generation for B2B orders and preliminary documents.
 *
 * Order numbers       ? `PED-YYYY-NNNNNN`  (Sequence row `B2B_ORDER`)
 * Proforma numbers    ? `PRO-YYYY-NNNNNN`  (Sequence row `B2B_PROFORMA`)
 * Quotation numbers   ? `PRES-YYYY-NNNNNN` (Sequence row `B2B_QUOTATION`)
 *
 * Fiscal documents (INVOICE, CORRECTIVE_INVOICE) are NEVER numbered by the
 * application: the admin always enters the number assigned by the business's
 * accounting (see normalizeManualDocumentNumber). Uniqueness is enforced by
 * the unique `B2bDocument.number` column.
 *
 * Counters use an atomic `increment`, safe against concurrent requests, and
 * must be pulled inside the transaction that persists the row so a failed
 * write rolls the counter back.
 */

import type { B2bDocumentType, Prisma } from '@prisma/client';
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

/** Document types whose number is always entered manually by the admin. */
export const MANUAL_NUMBER_DOCUMENT_TYPES: readonly B2bDocumentType[] = ['INVOICE', 'CORRECTIVE_INVOICE'];

export function requiresManualDocumentNumber(type: B2bDocumentType): boolean {
  return MANUAL_NUMBER_DOCUMENT_TYPES.includes(type);
}

/**
 * Next number of a PRELIMINARY document series (PROFORMA / QUOTATION).
 * Throws for fiscal types, which are never auto-numbered.
 * MUST be called inside the transaction that creates the B2bDocument row.
 */
export async function generateB2bDocumentNumber(
  type: B2bDocumentType,
  tx: TxClient = db
): Promise<string> {
  if (type !== 'PROFORMA' && type !== 'QUOTATION') {
    throw new Error(`Document type ${type} must be numbered manually`);
  }
  const build = async (): Promise<string> => {
    const series = {
      PROFORMA: { sequence: 'B2B_PROFORMA', prefix: 'PRO' },
      QUOTATION: { sequence: 'B2B_QUOTATION', prefix: 'PRES' },
    }[type];
    const row = await tx.sequence.upsert({
      where: { name: series.sequence },
      create: { name: series.sequence, value: 1 },
      update: { value: { increment: 1 } },
      select: { value: true },
    });
    return `${series.prefix}-${new Date().getFullYear()}-${String(row.value).padStart(6, '0')}`;
  };

  // Admins may assign numbers manually; skip any series value already used that way.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = await build();
    const taken = await tx.b2bDocument.findUnique({ where: { number: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new Error('Could not find a free document number');
}

/**
 * Validate an admin-supplied document number. Uppercased; only A–Z, 0–9 and
 * hyphens (so it maps 1:1 onto the storage key), 3–50 chars.
 */
export function normalizeManualDocumentNumber(raw: unknown): { number: string } | { error: string } | null {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return null;
  if (typeof raw !== 'string') return { error: 'Número de documento no válido.' };
  const number = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,49}$/.test(number)) {
    return { error: 'El número de documento solo admite letras, números y guiones (3-50 caracteres).' };
  }
  return { number };
}
