import type { Product } from '@/types';
import { LANGUAGE_SEO } from './languages';
import { getCategoryForProductType } from '@/lib/products/categories';
import { DEFAULT_OG_IMAGE, LOGO_PATH, SITE_CONTACT, SITE_LANG, SITE_NAME, SITE_URL, absoluteUrl } from './site';
import { getProductDisplayName, getProductFinalPrice, isAccessory } from './product';

type JsonLdNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Only facts the site already publishes (contact page, footer). No invented profiles or address. */
export function organizationJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl(LOGO_PATH) },
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    description:
      'Tienda online de Pokémon TCG en España: booster boxes, sobres y productos en japonés, coreano, inglés y español.',
    email: SITE_CONTACT.email,
    telephone: SITE_CONTACT.telephone,
    areaServed: { '@type': 'Country', name: 'España' },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: SITE_CONTACT.email,
        telephone: SITE_CONTACT.telephone,
        areaServed: 'ES',
        availableLanguage: ['Spanish'],
      },
    ],
  };
}

export function websiteJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    inLanguage: SITE_LANG,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

export function breadcrumbJsonLd(items: BreadcrumbEntry[], currentPath?: string): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const href = item.href ?? (index === items.length - 1 ? currentPath : undefined);
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        ...(href ? { item: absoluteUrl(href) } : {}),
      };
    }),
  };
}

export function itemListJsonLd(products: Product[], limit = 24): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.slice(0, limit).map((p, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/product/${p.slug}`),
      name: getProductDisplayName(p),
    })),
  };
}

export function collectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  products: Product[];
}): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: SITE_LANG,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    ...(input.products.length > 0 ? { mainEntity: itemListJsonLd(input.products) } : {}),
  };
}

const NEW_CONDITION_TYPES = /booster|bundle|elite trainer|mystery|accesorio/i;

function offerAvailability(product: Product): string {
  if (product.isPreorder) return 'https://schema.org/PreOrder';
  return product.canPurchase ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

/**
 * Offer reflects the sealed/standard variant (the product that ships). The
 * "Apertura en Directo" option is a different service and is not an offer for
 * the physical product.
 */
export function productJsonLd(product: Product): JsonLdNode {
  const url = absoluteUrl(`/product/${product.slug}`);
  const lang = LANGUAGE_SEO[product.language];
  const category = getCategoryForProductType(product.type);
  const description = product.description.replace(/\s+/g, ' ').trim();

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: getProductDisplayName(product),
    description: description || getProductDisplayName(product),
    sku: product.slug,
    url,
    ...(product.imageUrl ? { image: [absoluteUrl(product.imageUrl)] } : {}),
    ...(isAccessory(product) ? {} : { brand: { '@type': 'Brand', name: 'Pokémon' } }),
    ...(category ? { category: category.label } : {}),
    ...(!isAccessory(product) && lang
      ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'Idioma', value: lang.label }] }
      : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      price: getProductFinalPrice(product).toFixed(2),
      availability: offerAvailability(product),
      ...(product.isPreorder && product.releaseDate ? { availabilityStarts: product.releaseDate } : {}),
      ...(product.type && NEW_CONDITION_TYPES.test(product.type)
        ? { itemCondition: 'https://schema.org/NewCondition' }
        : {}),
      seller: { '@id': ORGANIZATION_ID },
    },
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
}): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntityOfPage: absoluteUrl(input.path),
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: SITE_LANG,
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}
