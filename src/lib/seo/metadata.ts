import type { Metadata } from 'next';
import type { Product } from '@/types';
import { formatReleaseDate } from '@/lib/products/state';
import { DEFAULT_OG_IMAGE, SITE_LOCALE, SITE_NAME, absoluteUrl } from './site';
import { formatEuro, getProductDisplayName, getProductFinalPrice, truncateText } from './product';
import type { CatalogPageConfig } from './catalogPages';

interface PageMetadataInput {
  /** Title without the brand suffix; the root layout template appends it. */
  title: string;
  description: string;
  /** Canonical path (no query string). */
  path: string;
  image?: string | null;
  imageAlt?: string;
  /** Overrides the default `og:type` ("website"). */
  ogType?: 'website' | 'article';
  noindex?: boolean;
  /** Allow link discovery on noindex pages (e.g. internal search). */
  follow?: boolean;
  /** Use the title verbatim, skipping the root template (homepage). */
  absoluteTitle?: boolean;
}

/** Single entry point for page metadata so canonical/OG/Twitter stay consistent site-wide. */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  ogType = 'website',
  noindex = false,
  follow = false,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const ogImage = absoluteUrl(image || DEFAULT_OG_IMAGE);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      ...(noindex ? {} : { languages: { 'es-ES': url, 'x-default': url } }),
    },
    robots: noindex ? { index: false, follow } : undefined,
    openGraph: {
      type: ogType,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: fullTitle,
      description,
      images: [{ url: ogImage, alt: imageAlt ?? title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}

/** Metadata for private/transactional pages that must never be indexed. */
export function noIndexMetadata(title?: string): Metadata {
  return {
    ...(title ? { title } : {}),
    robots: { index: false, follow: false },
  };
}

export function generateCategoryMetadata(page: CatalogPageConfig): Metadata {
  return buildPageMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: page.path,
  });
}

const PRODUCT_TITLE_MAX = 47; // + " | TCG Iberia" keeps it near 60 characters

export function generateProductMetadata(product: Product): Metadata {
  const display = getProductDisplayName(product);
  const price = getProductFinalPrice(product);

  let verb = '';
  if (product.isPreorder) verb = 'Reservar ';
  else if (product.canPurchase) verb = 'Comprar ';
  const candidate = `${verb}${display}`;
  const title = candidate.length <= PRODUCT_TITLE_MAX ? candidate : display;

  const releaseDate = formatReleaseDate(product.releaseDate);
  let status: string;
  if (product.isPreorder) status = releaseDate ? `Reserva ya, lanzamiento ${releaseDate}` : 'Reserva disponible';
  else if (product.canPurchase) status = 'En stock';
  else status = 'Agotado temporalmente';

  const tail = `${status}. ${formatEuro(price)}. Envío a toda España.`;
  const firstParagraph = (product.description.split('\n').find((l) => l.trim().length > 0) ?? '').trim();
  const lead = firstParagraph.length >= 40 ? firstParagraph : `${display}: producto de Pokémon TCG original en TCG Iberia.`;
  const description = `${truncateText(lead, 155 - tail.length - 1)} ${tail}`;

  return buildPageMetadata({
    title,
    description,
    path: `/product/${product.slug}`,
    image: product.imageUrl,
    imageAlt: display,
  });
}
