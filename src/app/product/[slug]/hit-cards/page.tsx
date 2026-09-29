import { db } from '@/lib/db';
import { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { HitCardsClient } from '@/components/HitCardsClient';
import { publicProductWithHitCardsSelect, serializePublicProduct } from '@/lib/products/serialization';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { slug },
  });

  if (!product) {
    return {
      title: 'Product not found',
    };
  }

  return {
    title: `${product.name} - Best Hit Cards | TCG Iberia`,
    description: `Best hit cards and special editions for ${product.name}`,
  };
}

export default async function HitCardsPage({
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
            <p className="text-2xl font-bold text-text-primary mb-2">
              Producto no encontrado
            </p>
            <p className="text-text-secondary mb-6">
              El producto solicitado no se encuentra disponible.
            </p>
            <a
              href="/"
              className="text-premium-gold font-semibold hover:text-premium-gold_dark"
            >
              ← Volver a Inicio
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
      <HitCardsClient product={serializedProduct} />
      <Footer />
    </>
  );
}
