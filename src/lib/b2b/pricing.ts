/**
 * B2B order pricing — pure, side-effect-free and shared by the customer cart
 * flow (`POST /api/b2b/orders`) and the admin manual order flow.
 *
 * All arithmetic is done in integer euro cents so totals never drift:
 *   unit price (net)  = b2bNetPrice(product.b2bPrice)            → cents
 *   line gross        = unit × quantity
 *   line discount     = round(line gross × discount% / 100)
 *   line total        = line gross − line discount
 *   subtotal          = Σ line totals
 *   taxable base      = subtotal + shipping (shipping follows the main supply's VAT)
 *   IVA               = round(taxable base × vatRate)
 *   recargo (RE)      = round(taxable base × surchargeRate)   (0 unless the customer
 *                        is under "Recargo de Equivalencia")
 *   total             = taxable base + IVA + RE
 *
 * Client-supplied prices are never accepted: only product IDs, quantities and
 * (admin only) discount percentages / shipping cost.
 */

import type { B2bOrderLineSnapshot } from '@/types';
import { B2B_IVA_RATE, b2bNetPrice } from './company';

export const B2B_MAX_QTY_PER_LINE = 999;
export const B2B_MAX_LINES = 100;
export const B2B_MAX_SHIPPING_COST = 10_000;

export interface PricingProduct {
  id: string;
  name: string;
  slug: string;
  language: string;
  imageUrl: string | null;
  b2bPrice: number | null;
  visible: boolean;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  /** 0–100, max 2 decimals. Only honoured for admin-created orders. */
  discountPercent: number;
}

export type PricingRejectionReason = 'unavailable' | 'no_price';

export interface PricingResult {
  items: B2bOrderLineSnapshot[];
  rejections: Array<{ productId: string; reason: PricingRejectionReason }>;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  vatRate: number;
  ivaAmount: number;
  surchargeRate: number;
  surchargeAmount: number;
  total: number;
}

export const toCents = (eur: number): number => Math.round(eur * 100);
export const fromCents = (cents: number): number => cents / 100;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/**
 * Parse and validate raw line input.
 *  - lenient (customer cart): invalid lines are dropped, duplicates merged.
 *  - strict (admin): any invalid line / duplicate is reported as an error.
 */
export function parseOrderLines(
  raw: unknown,
  opts: { strict: boolean; allowDiscount: boolean }
): { lines: OrderLineInput[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw) || raw.length === 0) {
    return { lines: [], errors: ['El pedido no contiene productos.'] };
  }
  if (raw.length > B2B_MAX_LINES) {
    return { lines: [], errors: [`El pedido supera el máximo de ${B2B_MAX_LINES} líneas.`] };
  }

  const merged = new Map<string, OrderLineInput>();
  raw.forEach((entry, index) => {
    const label = `Línea ${index + 1}`;
    if (!entry || typeof entry !== 'object') {
      if (opts.strict) errors.push(`${label}: formato inválido.`);
      return;
    }
    const r = entry as Record<string, unknown>;
    const productId = typeof r.productId === 'string' ? r.productId.trim() : '';
    const quantity =
      typeof r.quantity === 'number' ? r.quantity : Number.parseInt(String(r.quantity), 10);

    if (!productId || productId.length > 64) {
      if (opts.strict) errors.push(`${label}: producto inválido.`);
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > B2B_MAX_QTY_PER_LINE) {
      if (opts.strict) {
        errors.push(`${label}: la cantidad debe ser un entero entre 1 y ${B2B_MAX_QTY_PER_LINE}.`);
      }
      return;
    }

    let discountPercent = 0;
    if (opts.allowDiscount && r.discountPercent !== undefined && r.discountPercent !== null && r.discountPercent !== '') {
      const d = typeof r.discountPercent === 'number' ? r.discountPercent : Number(r.discountPercent);
      if (!Number.isFinite(d) || d < 0 || d > 100 || !hasAtMostTwoDecimals(d)) {
        errors.push(`${label}: el descuento debe estar entre 0 y 100 (máx. 2 decimales).`);
        return;
      }
      discountPercent = d;
    }

    const prev = merged.get(productId);
    if (prev) {
      if (opts.strict) {
        errors.push(`${label}: producto duplicado; ajusta la cantidad de la línea existente.`);
        return;
      }
      const quantitySum = Math.min(prev.quantity + quantity, B2B_MAX_QTY_PER_LINE);
      merged.set(productId, { ...prev, quantity: quantitySum });
      return;
    }
    merged.set(productId, { productId, quantity, discountPercent });
  });

  const lines = Array.from(merged.values());
  if (lines.length === 0 && errors.length === 0) {
    errors.push('Ninguna línea del pedido es válida.');
  }
  return { lines, errors };
}

/** Validate a client-supplied shipping cost (net, EUR). Returns cents or an error. */
export function parseShippingCost(raw: unknown): { cents: number } | { error: string } {
  if (raw === undefined || raw === null || raw === '') return { cents: 0 };
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > B2B_MAX_SHIPPING_COST) {
    return { error: `Los gastos de envío deben estar entre 0 y ${B2B_MAX_SHIPPING_COST} €.` };
  }
  if (!hasAtMostTwoDecimals(value)) {
    return { error: 'Los gastos de envío admiten como máximo 2 decimales.' };
  }
  return { cents: toCents(value) };
}

/**
 * Price validated lines against canonical product data. Products that are
 * missing, hidden or lack a wholesale price are returned as rejections.
 */
export function priceB2bOrder(
  lines: OrderLineInput[],
  products: Map<string, PricingProduct>,
  opts: { shippingCostCents?: number; vatRate?: number; surchargeRate?: number } = {}
): PricingResult {
  const vatRate = opts.vatRate ?? B2B_IVA_RATE;
  const vatBasisPoints = Math.round(vatRate * 10_000);
  const surchargeRate = opts.surchargeRate ?? 0;
  const surchargeBasisPoints = Math.round(surchargeRate * 10_000);
  const shippingCents = opts.shippingCostCents ?? 0;

  const items: B2bOrderLineSnapshot[] = [];
  const rejections: PricingResult['rejections'] = [];
  let subtotalCents = 0;
  let discountCents = 0;

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product || !product.visible) {
      rejections.push({ productId: line.productId, reason: 'unavailable' });
      continue;
    }
    if (product.b2bPrice === null) {
      rejections.push({ productId: line.productId, reason: 'no_price' });
      continue;
    }

    const unitCents = toCents(b2bNetPrice(product.b2bPrice));
    const grossCents = unitCents * line.quantity;
    const percentBasisPoints = Math.round(line.discountPercent * 100);
    const lineDiscountCents = Math.round((grossCents * percentBasisPoints) / 10_000);
    const lineCents = grossCents - lineDiscountCents;

    subtotalCents += lineCents;
    discountCents += lineDiscountCents;

    items.push({
      productId: product.id,
      name: product.name,
      sku: product.slug,
      language: product.language,
      variant: 'SEALED',
      imageUrl: product.imageUrl,
      quantity: line.quantity,
      unitPriceEur: fromCents(unitCents),
      discountPercent: line.discountPercent,
      discountAmountEur: fromCents(lineDiscountCents),
      vatRate,
      lineTotal: fromCents(lineCents),
    });
  }

  const baseCents = subtotalCents + shippingCents;
  const ivaCents = Math.round((baseCents * vatBasisPoints) / 10_000);
  const surchargeCents = Math.round((baseCents * surchargeBasisPoints) / 10_000);

  return {
    items,
    rejections,
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountCents),
    shippingCost: fromCents(shippingCents),
    vatRate,
    ivaAmount: fromCents(ivaCents),
    surchargeRate,
    surchargeAmount: fromCents(surchargeCents),
    total: fromCents(baseCents + ivaCents + surchargeCents),
  };
}
