import { db } from '@/lib/db';
import { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { ProductDetailClient } from '@/components/ProductDetailClient';
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
    title: `${product.name} | TCG Iberia`,
    description: product.description,
  };
}

export default async function ProductDetail({
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
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Producto no encontrado
            </p>
            <p className="text-gray-600 mb-6">
              El producto solicitado no se encuentra disponible.
            </p>
            <a
              href="/"
              className="text-red-600 font-semibold hover:text-red-700"
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
      <ProductDetailClient product={serializedProduct} />
      <Footer />
    </>
  );
}