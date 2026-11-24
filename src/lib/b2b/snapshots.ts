/**
 * Readers/builders for the immutable JSON snapshots stored on B2B orders.
 * Tolerates legacy rows that only carry a subset of the fields.
 */

import type { B2bCustomer } from '@prisma/client';
import type { B2bCustomerSnapshot, B2bOrderLineSnapshot } from '@/types';

export function customerToSnapshot(c: Pick<
  B2bCustomer,
  'companyName' | 'vatNumber' | 'contactName' | 'email' | 'phone' | 'billingAddress' | 'shippingAddress'
>): B2bCustomerSnapshot {
  return {
    companyName: c.companyName,
    vatNumber: c.vatNumber,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    billingAddress: c.billingAddress ?? null,
    shippingAddress: c.shippingAddress,
  };
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function readOrderItems(json: unknown): B2bOrderLineSnapshot[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      productId: String(r.productId ?? ''),
      name: String(r.name ?? ''),
      sku: str(r.sku),
      language: str(r.language),
      variant: str(r.variant),
      imageUrl: str(r.imageUrl),
      quantity: num(r.quantity),
      unitPriceEur: num(r.unitPriceEur),
      discountPercent: num(r.discountPercent),
      discountAmountEur: num(r.discountAmountEur),
      vatRate: r.vatRate === undefined ? undefined : num(r.vatRate),
      lineTotal: num(r.lineTotal),
    }));
}

export function readCustomerSnapshot(json: unknown): B2bCustomerSnapshot {
  const r = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  return {
    companyName: String(r.companyName ?? ''),
    vatNumber: String(r.vatNumber ?? ''),
    contactName: String(r.contactName ?? ''),
    email: String(r.email ?? ''),
    phone: String(r.phone ?? ''),
    billingAddress: str(r.billingAddress),
    shippingAddress: String(r.shippingAddress ?? ''),
  };
}
