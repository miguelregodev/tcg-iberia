import type { Product } from '@/types';
import type { ProductLanguage } from '@/lib/seo/languages';

export interface ListingFilter {
  /** Case-insensitive substring of `Product.type`. Empty string matches every product. */
  productType: string;
  language?: ProductLanguage;
}

/** Same matching rules the category pages have always used for their grids. */
export function filterListingProducts(products: Product[], { productType, language }: ListingFilter): Product[] {
  const wantedType = productType.trim().toLowerCase();
  return products.filter((p) => {
    const typeMatch = wantedType ? !!p.type && p.type.toLowerCase().includes(wantedType) : true;
    const langMatch = !language || p.language === language;
    return typeMatch && langMatch;
  });
}

/** Same-type/same-language products first, then looser matches. Never includes the product itself. */
export function pickRelatedProducts(product: Product, catalog: Product[], limit = 4): Product[] {
  const scored = catalog
    .filter((p) => p.id !== product.id)
    .map((p) => {
      let score = 0;
      if (product.type && p.type && p.type.toLowerCase() === product.type.toLowerCase()) score += 2;
      if (p.language === product.language) score += 1;
      if (p.available || p.isPreorder) score += 0.5;
      return { p, score };
    })
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score || a.p.priority - b.p.priority);
  return scored.slice(0, limit).map(({ p }) => p);
}
