import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

type TxClient = Prisma.TransactionClient | typeof db;

/** Customer-facing shipment number, e.g. ENV-20261001-000042. Shares the same */
export async function generateShipmentNumber(tx: TxClient = db): Promise<string> {
  const seq = await tx.sequence.upsert({
    where: { name: 'SHIPMENT' },
    create: { name: 'SHIPMENT', value: 1 },
    update: { value: { increment: 1 } },
  });
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ENV-${timestamp}-${String(seq.value).padStart(6, '0')}`;
}

/** Shares one global sequence so every Redsys Ds_Merchant_Order value is unique
 * across both Order and Shipment rows (both payment flows use this same counter). */
export { nextRedsysOrderId } from '@/lib/payments/redsys/orderId';
