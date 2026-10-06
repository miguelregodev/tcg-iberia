import { db } from '@/lib/db';
import { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { B2BProductDetailClient } from '@/components/B2BProductDetailClient';
import { publicProductWithHitCardsSelect, serializePublicProduct } from '@/lib/products/serialization';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug } });
  if (!product) return { title: 'Producto no encontrado' };
  return {
    title: `${product.name} — Precio B2B`,
    description: product.description,
  };
}

export default async function B2BProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { slug },
    select: publicProductWithHitCardsSelect,
  });

  if (!product || !product.visible) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-dark-bg flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-text-primary mb-2">Producto no encontrado</p>
            <p className="text-text-secondary mb-6">El producto solicitado no está disponible.</p>
            <a href="/b2b-catalog" className="text-premium-gold font-semibold hover:text-premium-gold_dark">
              ← Volver al catálogo B2B
            </a>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const serializedProduct = serializePublicProduct(product);

  return (
    <>
      <Navigation />
      <B2BProductDetailClient product={serializedProduct} />
      <Footer />
    </>
  );
}
