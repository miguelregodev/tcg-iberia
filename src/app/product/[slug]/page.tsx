import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { ProductDetailClient } from '@/components/ProductDetailClient';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/Breadcrumbs';
import { getCategoryForProductType } from '@/lib/products/categories';
import { getPublicCatalog, getPublicProductBySlug } from '@/lib/products/catalog';
import { pickRelatedProducts } from '@/lib/products/listing';
import { formatReleaseDate } from '@/lib/products/state';
import { productJsonLd } from '@/lib/seo/jsonld';
import { LANGUAGE_SEO } from '@/lib/seo/languages';
import { generateProductMetadata, noIndexMetadata } from '@/lib/seo/metadata';
import { isAccessory } from '@/lib/seo/product';
import type { Product } from '@/types';

// Short ISR window keeps stock/price fresh while serving cached HTML to crawlers.
export const revalidate = 60;

// Empty list opts the route into on-demand ISR (pages are built on first request, then cached).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) return noIndexMetadata('Producto no encontrado');
  return generateProductMetadata(product);
}

async function getRelatedProducts(product: Product): Promise<Product[]> {
  try {
    return pickRelatedProducts(product, await getPublicCatalog());
  } catch (error) {
    console.error('product page: failed to load related products', error);
    return [];
  }
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await getPublicProductBySlug(slug);

  if (!product) notFound();

  const category = getCategoryForProductType(product.type);
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Inicio', href: '/' },
    ...(category ? [{ label: category.label, href: category.href }] : []),
    { label: product.name },
  ];

  const related = await getRelatedProducts(product);
  const lang = LANGUAGE_SEO[product.language];
  const releaseDate = formatReleaseDate(product.releaseDate);
  const showLanguage = !isAccessory(product) && !!lang;

  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <Navigation />
      <Breadcrumbs items={breadcrumbItems} />
      <ProductDetailClient product={product} />

      <section className="bg-dark-bg border-t border-dark-border" aria-labelledby="product-details-heading">
        <div className="container-custom px-4 py-10 md:py-14">
          <h2 id="product-details-heading" className="text-xl md:text-2xl font-bold text-text-primary mb-4">
            Detalles del producto
          </h2>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 max-w-2xl text-sm">
            {category && (
              <div className="flex gap-2">
                <dt className="text-text-muted">Categoría:</dt>
                <dd>
                  <Link href={category.href} className="text-premium-gold hover:underline underline-offset-4">
                    {category.label}
                  </Link>
                </dd>
              </div>
            )}
            {showLanguage && (
              <div className="flex gap-2">
                <dt className="text-text-muted">Idioma:</dt>
                <dd>
                  {lang.landingPath ? (
                    <Link href={lang.landingPath} className="text-premium-gold hover:underline underline-offset-4">
                      {lang.label}
                    </Link>
                  ) : (
                    <span className="text-text-secondary">{lang.label}</span>
                  )}
                </dd>
              </div>
            )}
            {releaseDate && (
              <div className="flex gap-2">
                <dt className="text-text-muted">Lanzamiento:</dt>
                <dd className="text-text-secondary">{releaseDate}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-text-muted">Envío:</dt>
              <dd>
                <Link href="/politica-envio" className="text-premium-gold hover:underline underline-offset-4">
                  Política de envío
                </Link>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-dark-bgSecondary border-t border-dark-border" aria-labelledby="related-products-heading">
          <div className="container-custom px-4 py-10 md:py-14">
            <h2 id="related-products-heading" className="text-xl md:text-2xl font-bold text-text-primary mb-6">
              Productos relacionados
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} showLanguageFlag={!isAccessory(item)} />
              ))}
            </div>
          </div>
        </section>
      )}
      <Footer />
    </>
  );
}