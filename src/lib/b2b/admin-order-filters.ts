/**
 * Admin B2B order list filters — pure parsing of query params into a Prisma
 * `where` / `orderBy` so filtering, sorting and pagination happen in the DB.
 */

import type { Prisma } from '@prisma/client';
import type {
  B2bFulfillmentStatusValue,
  B2bOrderLifecycleStatus,
  B2bOrderSourceValue,
  B2bPaymentStatusValue,
} from '@/types';

const LIFECYCLE: readonly B2bOrderLifecycleStatus[] = ['PENDING', 'ACCEPTED', 'CANCELLED', 'REJECTED'];
const PAYMENT: readonly B2bPaymentStatusValue[] = ['PENDING', 'PAID', 'REFUNDED', 'CANCELLED'];
const FULFILLMENT: readonly B2bFulfillmentStatusValue[] = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
];
const SOURCES: readonly B2bOrderSourceValue[] = ['CUSTOMER', 'ADMIN'];
const INVOICE_FILTERS = ['issued', 'none', 'failed'] as const;
const SORT_FIELDS = ['createdAt', 'total', 'status', 'paymentStatus', 'fulfillmentStatus'] as const;

export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];
export type SortField = (typeof SORT_FIELDS)[number];

export interface AdminOrderFilters {
  q: string | null;
  email: string | null;
  company: string | null;
  vat: string | null;
  orderNumber: string | null;
  status: B2bOrderLifecycleStatus | null;
  paymentStatus: B2bPaymentStatusValue | null;
  fulfillmentStatus: B2bFulfillmentStatusValue | null;
  source: B2bOrderSourceValue | null;
  invoice: InvoiceFilter | null;
  from: Date | null;
  to: Date | null;
  sort: SortField;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const ADMIN_ORDERS_MAX_PAGE_SIZE = 100;

function text(params: URLSearchParams, key: string): string | null {
  const v = params.get(key)?.trim();
  return v ? v.slice(0, 120) : null;
}

function oneOf<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T | null {
  const v = params.get(key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Parses YYYY-MM-DD; `endOfDay` makes the bound inclusive (Europe/Madrid-agnostic UTC day). */
function day(params: URLSearchParams, key: string, endOfDay: boolean): Date | null {
  const v = params.get(key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function int(params: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(params.get(key) ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function parseAdminOrderFilters(params: URLSearchParams): AdminOrderFilters {
  return {
    q: text(params, 'q'),
    email: text(params, 'email'),
    company: text(params, 'company'),
    vat: text(params, 'vat'),
    orderNumber: text(params, 'orderNumber'),
    status: oneOf(params, 'status', LIFECYCLE),
    paymentStatus: oneOf(params, 'paymentStatus', PAYMENT),
    fulfillmentStatus: oneOf(params, 'fulfillmentStatus', FULFILLMENT),
    source: oneOf(params, 'source', SOURCES),
    invoice: oneOf(params, 'invoice', INVOICE_FILTERS),
    from: day(params, 'from', false),
    to: day(params, 'to', true),
    sort: oneOf(params, 'sort', SORT_FIELDS) ?? 'createdAt',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
    page: int(params, 'page', 1, 1, 100_000),
    pageSize: int(params, 'pageSize', 20, 1, ADMIN_ORDERS_MAX_PAGE_SIZE),
  };
}

const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

export function buildAdminOrderWhere(f: AdminOrderFilters): Prisma.B2bOrderWhereInput {
  const and: Prisma.B2bOrderWhereInput[] = [];

  if (f.q) {
    and.push({
      OR: [
        { orderNumber: contains(f.q) },
        { customer: { is: { email: contains(f.q) } } },
        { customer: { is: { companyName: contains(f.q) } } },
        { customer: { is: { vatNumber: contains(f.q) } } },
        { documents: { some: { number: contains(f.q) } } },
        { trackingNumber: contains(f.q) },
      ],
    });
  }
  if (f.email) and.push({ customer: { is: { email: contains(f.email) } } });
  if (f.company) {
    and.push({
      OR: [
        { customer: { is: { companyName: contains(f.company) } } },
        { customer: { is: { contactName: contains(f.company) } } },
      ],
    });
  }
  if (f.vat) and.push({ customer: { is: { vatNumber: contains(f.vat) } } });
  if (f.orderNumber) and.push({ orderNumber: contains(f.orderNumber) });
  if (f.status) and.push({ status: f.status });
  if (f.paymentStatus) and.push({ paymentStatus: f.paymentStatus });
  if (f.fulfillmentStatus) and.push({ fulfillmentStatus: f.fulfillmentStatus });
  if (f.source) and.push({ source: f.source });
  if (f.invoice === 'issued') and.push({ documents: { some: { type: 'INVOICE', status: 'ISSUED' } } });
  if (f.invoice === 'none') and.push({ documents: { none: { type: 'INVOICE' } } });
  if (f.invoice === 'failed') {
    and.push({ documents: { some: { type: 'INVOICE', status: { in: ['FAILED', 'GENERATING'] } } } });
  }
  if (f.from || f.to) {
    and.push({ createdAt: { ...(f.from && { gte: f.from }), ...(f.to && { lte: f.to }) } });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildAdminOrderOrderBy(f: AdminOrderFilters): Prisma.B2bOrderOrderByWithRelationInput[] {
  const primary = { [f.sort]: f.dir } as Prisma.B2bOrderOrderByWithRelationInput;
  return f.sort === 'createdAt' ? [primary, { id: f.dir }] : [primary, { createdAt: 'desc' }];
}
