'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnouncementBanner } from '@/types';

const ROTATION_INTERVAL_MS = 4000;
const TRANSITION_DURATION_MS = 400;

/** Fetches enabled banners from the public API. */
async function fetchBanners(): Promise<AnnouncementBanner[]> {
  try {
    const res = await fetch('/api/banners', { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function AnnouncementBannerBar() {
  const [banners, setBanners] = useState<AnnouncementBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true); // controls the enter/exit animation phase

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load banners once on mount
  useEffect(() => {
    fetchBanners().then((data) => {
      setBanners(data);
    });
  }, []);

  // Advance to next banner with a fade-out → swap → fade-in cycle
  const advance = useCallback(() => {
    setVisible(false);

    transitionRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
      setVisible(true);
    }, TRANSITION_DURATION_MS);
  }, [banners.length]);

  // Start / restart interval whenever banners change
  useEffect(() => {
    if (banners.length <= 1) return; // no rotation needed for 0 or 1 banners

    intervalRef.current = setInterval(advance, ROTATION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, [banners.length, advance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, []);

  // Clamp active index in case banners shrink
  const safeIndex = banners.length > 0 ? activeIndex % banners.length : 0;
  const currentBanner = banners[safeIndex] ?? null;

  // Nothing to show
  if (!currentBanner) return null;

  return (
    <div
      className="bg-red-600 text-white sticky top-[65px] z-40"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Anuncios de la tienda"
    >
      <div className="container-custom px-4 py-2 flex items-center justify-center min-h-[36px]">
        <p
          className="text-xs sm:text-sm font-medium text-center leading-snug"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-6px)',
            transition: `opacity ${TRANSITION_DURATION_MS}ms ease-out, transform ${TRANSITION_DURATION_MS}ms ease-out`,
            // Reserve space so height is stable during transitions
            minHeight: '1.25rem',
          }}
        >
          {currentBanner.text}
        </p>
      </div>
    </div>
  );
}
