'use client';

import { InfiniteProductCarousel } from './InfiniteProductCarousel';

export function FeaturedProductCarousel() {
  return <InfiniteProductCarousel endpoint="/api/products/featured" />;
}