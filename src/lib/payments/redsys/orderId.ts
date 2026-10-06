import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

type TxClient = Prisma.TransactionClient | typeof db;

/**
 * Generates a fresh Ds_Merchant_Order value: exactly 12 numeric digits, built from the
 * current unix timestamp (10 digits) plus a 2-digit 'REDSYS_ORDER' sequence suffix.
 * Values stay effectively monotonic and are immune to that Sequence row ever being
 * reset (e.g. a local dev DB reset) — a bare incrementing counter would otherwise
 * regenerate low values Redsys's sandbox already remembers as used, causing
 * SIS0051 "Número de pedido repetido".
 */
export async function nextRedsysOrderId(tx: TxClient = db): Promise<string> {
  const seq = await tx.sequence.upsert({
    where: { name: 'REDSYS_ORDER' },
    create: { name: 'REDSYS_ORDER', value: 1 },
    update: { value: { increment: 1 } },
  });

  const timestampSeconds = Math.floor(Date.now() / 1000) % 10_000_000_000;
  const suffix = String(seq.value % 100).padStart(2, '0');
  return `${String(timestampSeconds).padStart(10, '0')}${suffix}`;
}
