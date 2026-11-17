'use client';

import { useEffect, useState, type TouchEvent } from 'react';
import { HeroSlideContent } from '@/components/HeroSlideContent';
import {
  HERO_AUTOPLAY_INTERVAL_MS,
  getNextIndex,
  getPrevIndex,
  getSwipeDirection,
  shouldAutoplay,
} from '@/lib/hero-slides/carousel';
import type { PublicHeroSlide } from '@/types';

interface HeroSlideshowProps {
  slides: PublicHeroSlide[];
}

interface TouchOrigin {
  x: number;
  y: number;
}

/** Full-width homepage carousel with cross-fade, autoplay, swipe, and keyboard-accessible controls. */
export function HeroSlideshow({ slides }: HeroSlideshowProps) {
  const count = slides.length;
  const [rawIndex, setRawIndex] = useState(0);
  // Bumped on manual navigation so the autoplay timer restarts from full duration.
  const [cycle, setCycle] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [touchOrigin, setTouchOrigin] = useState<TouchOrigin | null>(null);

  const index = rawIndex < count ? rawIndex : 0;
  const isPlaying = shouldAutoplay({
    count,
    isPaused: isHovered,
    isTabHidden,
    prefersReducedMotion,
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setPrefersReducedMotion(media.matches);
    syncMotion();
    media.addEventListener('change', syncMotion);

    const syncVisibility = () => setIsTabHidden(document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);

    return () => {
      media.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      setRawIndex((current) => getNextIndex(current, count));
    }, HERO_AUTOPLAY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [isPlaying, index, cycle, count]);

  if (count === 0) return null;

  const goTo = (next: number) => {
    setRawIndex(next);
    setCycle((value) => value + 1);
  };
  const goNext = () => goTo(getNextIndex(index, count));
  const goPrev = () => goTo(getPrevIndex(index, count));

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    // Touches that start on a control must not start a swipe.
    if ((event.target as HTMLElement).closest('button')) {
      setTouchOrigin(null);
      return;
    }
    const touch = event.touches[0];
    setTouchOrigin({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const origin = touchOrigin;
    setTouchOrigin(null);
    if (!origin) return;
    const touch = event.changedTouches[0];
    const direction = getSwipeDirection(touch.clientX - origin.x, touch.clientY - origin.y);
    if (direction === 'next') goNext();
    if (direction === 'prev') goPrev();
  };

  const transitionClass = prefersReducedMotion ? 'duration-0' : 'duration-700';

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados"
      className="relative w-full aspect-[16/9] md:aspect-auto h-auto md:h-[70vh] md:min-h-[440px] md:max-h-[820px] overflow-hidden bg-dark-bgSecondary border-b border-dark-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setTouchOrigin(null)}
    >
      <div className="relative h-full w-full">
        {slides.map((slide, slideIndex) => {
          const isActive = slideIndex === index;
          const isFirst = slideIndex === 0;

          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${slideIndex + 1} de ${count}`}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity ease-in-out ${transitionClass} ${
                isActive ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-contain object-center md:object-cover"
                loading={isFirst ? 'eager' : 'lazy'}
                fetchPriority={isFirst ? 'high' : 'auto'}
                decoding="async"
                draggable={false}
              />
              <HeroSlideContent
                headline={slide.headline}
                buttonLabel={slide.buttonLabel}
                subtitle={slide.subtitle}
                destinationUrl={slide.destinationUrl}
                tabbable={isActive}
              />
            </div>
          );
        })}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Diapositiva anterior"
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-dark-bg/70 text-text-primary transition-colors hover:bg-dark-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold md:left-4"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Diapositiva siguiente"
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-dark-bg/70 text-text-primary transition-colors hover:bg-dark-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold md:right-4"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1">
              {slides.map((slide, dotIndex) => {
                const isCurrent = dotIndex === index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(dotIndex)}
                    aria-label={`Ir a la diapositiva ${dotIndex + 1}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    className="flex h-6 w-6 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold rounded-full"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        isCurrent ? 'bg-premium-gold' : 'bg-text-primary/50'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
