import { db } from '@/lib/db';
import { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { ProductDetailClient } from '@/components/ProductDetailClient';

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
  });

  if (!product || !product.visible) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Product Not Found
            </p>
            <p className="text-gray-600 mb-6">
              The product you're looking for doesn't exist or is no longer available.
            </p>
            <a
              href="/"
              className="text-red-600 font-semibold hover:text-red-700"
            >
              ← Back to Home
            </a>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const serializedProduct = {
    ...product,
    price: Number(product.price),
    discountPercentage: product.discountPercentage
      ? Number(product.discountPercentage)
      : null,
    available: product.stock > 0,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };

  return (
    <>
      <Navigation />
      <ProductDetailClient product={serializedProduct} />
      <Footer />
    </>
  );
}