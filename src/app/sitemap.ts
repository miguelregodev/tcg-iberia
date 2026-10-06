import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { getPublicCatalog } from '@/lib/products/catalog';
import { CATALOG_PAGES } from '@/lib/seo/catalogPages';
import { GUIDES } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';
import { captureServerError } from '@/lib/observability/sentry';

export const revalidate = 3600;

const STATIC_PAGES = [
  '/distribuidor-tcg-espana',
  '/releases-calendar',
  '/guias',
  '/contacto',
  '/politica-envio',
  '/envio-agrupado',
  '/politica-reembolso',
  '/politica-cancelacion',
  '/politica-apertura-en-directo',
  '/aviso-legal',
  '/terminos-servicio',
  '/politica-privacidad',
];

/** Only canonical, indexable URLs. Catalog failures degrade to static pages instead of failing the sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    ...Object.keys(CATALOG_PAGES).map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'daily' as const,
      priority: path.startsWith('/pokemon-tcg-') || path === '/booster-boxes' ? 0.9 : 0.8,
    })),
    ...STATIC_PAGES.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'monthly' as const,
      priority: path === '/distribuidor-tcg-espana' || path === '/guias' ? 0.7 : 0.3,
    })),
    ...GUIDES.map((guide) => ({
      url: absoluteUrl(`/guias/${guide.slug}`),
      lastModified: guide.dateModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  try {
    const [catalog, productsWithHits] = await Promise.all([
      getPublicCatalog(),
      db.product.findMany({
        where: { visible: true, hitCards: { some: {} } },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    for (const product of catalog) {
      entries.push({
        url: absoluteUrl(`/product/${product.slug}`),
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
        ...(product.imageUrl ? { images: [absoluteUrl(product.imageUrl)] } : {}),
      });
    }

    for (const product of productsWithHits) {
      entries.push({
        url: absoluteUrl(`/product/${product.slug}/hit-cards`),
        lastModified: product.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.4,
      });
    }
  } catch (error) {
    console.error('sitemap: failed to load products', error);
    captureServerError({ error, module: 'sitemap' });
  }

  return entries;
}
