import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';
import { Preorders } from './Preorders';
import { PreorderProductCarousel } from './PreorderProductCarousel';
import { ProductCard } from './ProductCard';

const CAROUSEL_THRESHOLD = 4;

export async function PreordersSection() {
  noStore();
  const products = await db.product.findMany({
    where: {
      visible: true,
      releaseDate: { gt: new Date() },
    },
    orderBy: [{ releaseDate: 'asc' }, { priority: 'asc' }],
    take: 12,
    select: publicProductSelect,
  });

  if (products.length === 0) return null;

  const serialized = products.map(serializePublicProduct);

  return (
    <>
      <Preorders />
      {serialized.length > CAROUSEL_THRESHOLD ? (
        <PreorderProductCarousel />
      ) : (
        <section className="py-12 bg-white">
          <div className="container-custom px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {serialized.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
