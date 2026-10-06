import { describe, expect, it } from 'vitest';

import type { Product } from '@/types';
import { filterListingProducts, pickRelatedProducts } from '@/lib/products/listing';
import { productJsonLd } from './jsonld';
import { generateProductMetadata } from './metadata';
import { getProductDisplayName, getProductFinalPrice } from './product';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Inferno X Booster Box',
    slug: 'inferno-x-booster-box-jp',
    description: 'Caja sellada con todos los sobres de la expansión Inferno X.',
    price: 100,
    discountPercentage: null,
    liveOpeningPrice: null,
    b2bPrice: null,
    notes: null,
    type: 'Booster Box',
    releaseDate: null,
    stock: 10,
    imageUrl: 'https://example.supabase.co/storage/v1/object/public/p/inferno.png',
    language: 'JAPANESE',
    priority: 1,
    visible: true,
    available: true,
    canPurchase: true,
    isPreorder: false,
    inventoryStatus: 'available',
    weightGrams: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('product SEO helpers', () => {
  it('appends the language only when the name does not already mention it', () => {
    expect(getProductDisplayName(makeProduct())).toBe('Inferno X Booster Box Japonés');
    expect(getProductDisplayName(makeProduct({ name: 'Inferno X Booster Box Japonés' }))).toBe(
      'Inferno X Booster Box Japonés',
    );
    expect(getProductDisplayName(makeProduct({ type: 'Accesorios', name: 'Fundas' }))).toBe('Fundas');
  });

  it('applies the percentage discount to the final price', () => {
    expect(getProductFinalPrice(makeProduct({ price: 100, discountPercentage: 15 }))).toBe(85);
  });

  it('builds a unique title and a description within length limits', () => {
    const meta = generateProductMetadata(makeProduct());
    expect(meta.title).toBe('Comprar Inferno X Booster Box Japonés');
    expect((meta.description ?? '').length).toBeLessThanOrEqual(160);
    expect(meta.description).toContain('En stock');
    expect(meta.alternates?.canonical).toMatch(/\/product\/inferno-x-booster-box-jp$/);
  });

  it('uses reservation wording for preorders and no verb when sold out', () => {
    expect(generateProductMetadata(makeProduct({ isPreorder: true })).title).toBe(
      'Reservar Inferno X Booster Box Japonés',
    );
    expect(
      generateProductMetadata(makeProduct({ canPurchase: false, available: false, stock: 0 })).title,
    ).toBe('Inferno X Booster Box Japonés');
  });
});

describe('productJsonLd', () => {
  it('reflects real price, currency and availability', () => {
    const ld = productJsonLd(makeProduct({ discountPercentage: 10 })) as {
      '@type': string;
      offers: { price: string; priceCurrency: string; availability: string };
    };
    expect(ld['@type']).toBe('Product');
    expect(ld.offers.price).toBe('90.00');
    expect(ld.offers.priceCurrency).toBe('EUR');
    expect(ld.offers.availability).toBe('https://schema.org/InStock');
  });

  it('maps out-of-stock and preorder availability', () => {
    const out = productJsonLd(makeProduct({ canPurchase: false, stock: 0 })) as { offers: { availability: string } };
    const pre = productJsonLd(makeProduct({ isPreorder: true, releaseDate: '2027-01-01T00:00:00.000Z' })) as {
      offers: { availability: string; availabilityStarts: string };
    };
    expect(out.offers.availability).toBe('https://schema.org/OutOfStock');
    expect(pre.offers.availability).toBe('https://schema.org/PreOrder');
    expect(pre.offers.availabilityStarts).toBe('2027-01-01T00:00:00.000Z');
  });

  it('omits the Pokémon brand for accessories', () => {
    const ld = productJsonLd(makeProduct({ type: 'Accesorios', name: 'Fundas' })) as { brand?: unknown };
    expect(ld.brand).toBeUndefined();
  });
});

describe('listing helpers', () => {
  const catalog = [
    makeProduct({ id: 'a', type: 'Booster Box', language: 'JAPANESE' }),
    makeProduct({ id: 'b', type: 'Booster Pack', language: 'KOREAN' }),
    makeProduct({ id: 'c', type: null, language: 'JAPANESE' }),
  ];

  it('filters by type and language, and an empty type matches everything', () => {
    expect(filterListingProducts(catalog, { productType: 'booster box' }).map((p) => p.id)).toEqual(['a']);
    expect(filterListingProducts(catalog, { productType: '', language: 'JAPANESE' }).map((p) => p.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('suggests same-type products and never the product itself', () => {
    const current = catalog[0];
    const extra = makeProduct({ id: 'd', type: 'Booster Box', language: 'KOREAN' });
    const related = pickRelatedProducts(current, [...catalog, extra]);
    expect(related.map((p) => p.id)).toEqual(['d']);
  });
});
