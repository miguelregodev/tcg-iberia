import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { publicProductSelect, serializePublicProduct } from '@/lib/products/serialization';
import { Preorders } from './Preorders';
import { PreorderProductCarousel } from './PreorderProductCarousel';
import { ProductCard } from './ProductCard';

/** On desktop (≥ lg) the carousel activates when there are more than 4 products. */
const DESKTOP_CAROUSEL_THRESHOLD = 4;
/** On mobile (< lg) the carousel activates when there is more than 1 product. */
const MOBILE_CAROUSEL_THRESHOLD = 1;

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
  const count = serialized.length;

  const showCarouselMobile = count > MOBILE_CAROUSEL_THRESHOLD;
  const showCarouselDesktop = count > DESKTOP_CAROUSEL_THRESHOLD;

  const ProductGrid = (
    <section className="py-12 bg-white">
      <div className="container-custom px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {serialized.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <>
      <Preorders />

      {/* Both thresholds met → carousel everywhere */}
      {showCarouselMobile && showCarouselDesktop && (
        <PreorderProductCarousel />
      )}

      {/* Only mobile threshold met → carousel on mobile, grid on desktop */}
      {showCarouselMobile && !showCarouselDesktop && (
        <>
          <div className="block lg:hidden">
            <PreorderProductCarousel />
          </div>
          <div className="hidden lg:block">
            {ProductGrid}
          </div>
        </>
      )}

      {/* Neither threshold met → grid everywhere */}
      {!showCarouselMobile && ProductGrid}
    </>
  );
}
