'use client';

import { InfiniteProductCarousel } from './InfiniteProductCarousel';

export function PreorderProductCarousel() {
  return <InfiniteProductCarousel endpoint="/api/products/preorders" />;
}