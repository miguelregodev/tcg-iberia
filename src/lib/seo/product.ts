import type { Product } from '@/types';
import { LANGUAGE_SEO } from './languages';

const ACCESSORY_RE = /accesorio/i;

export function isAccessory(product: Pick<Product, 'type'>): boolean {
  return ACCESSORY_RE.test(product.type ?? '');
}

/** Name plus the product language when the name doesn't already state it (e.g. "Inferno X Booster Box Japonés"). */
export function getProductDisplayName(product: Pick<Product, 'name' | 'language' | 'type'>): string {
  const lang = LANGUAGE_SEO[product.language];
  if (!lang || isAccessory(product) || lang.namePattern.test(product.name)) return product.name;
  return `${product.name} ${lang.label}`;
}

/** Price the customer pays for the sealed/standard variant after any percentage discount. */
export function getProductFinalPrice(product: Pick<Product, 'price' | 'discountPercentage'>): number {
  const base = Number(product.price);
  const discount = Number(product.discountPercentage ?? 0);
  const final = discount > 0 ? base * (1 - discount / 100) : base;
  return Math.round(final * 100) / 100;
}

export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

/** Collapses whitespace and cuts at a word boundary, adding an ellipsis when truncated. */
export function truncateText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:.-]+$/, '')}…`;
}
