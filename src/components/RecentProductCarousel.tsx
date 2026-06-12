'use client';

import { InfiniteProductCarousel } from './InfiniteProductCarousel';

export function RecentProductCarousel() {
  return <InfiniteProductCarousel endpoint="/api/products/recent" />;
}