'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics/events';

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const page = query ? `${pathname}?${query}` : pathname;
    trackEvent('$pageview', { page });
  }, [pathname, searchParams]);

  return null;
}
