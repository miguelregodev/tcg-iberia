import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { HitCardsClient } from '@/components/HitCardsClient';
import { getPublicProductBySlug } from '@/lib/products/catalog';
import { buildPageMetadata, noIndexMetadata } from '@/lib/seo/metadata';
import { getProductDisplayName } from '@/lib/seo/product';

export const revalidate = 60;

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

  if (!product || !product.hitCards?.length) return noIndexMetadata('Producto no encontrado');

  const display = getProductDisplayName(product);
  return buildPageMetadata({
    title: `Mejores hits de ${display}`,
    description: `Las cartas más buscadas de ${display}: ${product.hitCards.length} hits con su imagen y precio de mercado orientativo.`,
    path: `/product/${product.slug}/hit-cards`,
    image: product.imageUrl,
    imageAlt: display,
  });
}

export default async function HitCardsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await getPublicProductBySlug(slug);

  if (!product) notFound();

  return (
    <>
      <Navigation />
      <HitCardsClient product={product} />
      <Footer />
    </>
  );
}
