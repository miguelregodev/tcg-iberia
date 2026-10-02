/**
 * Canonical mapping of `Product.type` substrings to the public category
 * listing page that showcases that type. Mirrors the `productType` prop
 * each category page passes to `ProductListPage` (case-insensitive
 * "includes" match), so a product's breadcrumb category always points to
 * the same page where that product actually appears.
 */
export interface ProductCategory {
  label: string;
  href: string;
}

interface CategoryRule extends ProductCategory {
  /** Lowercased substring matched against `Product.type`. */
  match: string;
}

// Ordered most-specific first to avoid broader substrings (e.g. "pack")
// shadowing a more specific category (e.g. "booster box").
const CATEGORY_RULES: CategoryRule[] = [
  { label: 'Booster Boxes', href: '/booster-boxes', match: 'booster box' },
  { label: 'Elite Trainer Boxes', href: '/etbs', match: 'elite trainer box' },
  { label: 'Booster Bundles', href: '/booster-bundles', match: 'bundle' },
  { label: 'Booster Packs', href: '/booster-packs', match: 'pack' },
  { label: 'Mystery Packs', href: '/mystery-packs', match: 'mystery' },
  { label: 'PSA', href: '/psa', match: 'psa' },
  { label: 'Accesorios', href: '/accesorios', match: 'accesorios' },
];

/** Resolves the canonical category (label + href) for a product's `type`, or `null` if none matches. */
export function getCategoryForProductType(type: string | null | undefined): ProductCategory | null {
  if (!type) return null;
  const normalized = type.toLowerCase();
  const rule = CATEGORY_RULES.find((r) => normalized.includes(r.match));
  return rule ? { label: rule.label, href: rule.href } : null;
}
