/**
 * Pure carousel helpers used by the homepage hero slideshow.
 */

export const HERO_AUTOPLAY_INTERVAL_MS = 5000;
export const HERO_SWIPE_THRESHOLD_PX = 50;

export function getNextIndex(current: number, count: number): number {
  if (count <= 0) return 0;
  return (current + 1) % count;
}

export function getPrevIndex(current: number, count: number): number {
  if (count <= 0) return 0;
  return (current - 1 + count) % count;
}

/**
 * Maps a touch delta to a navigation direction.
 * Requires a horizontal swipe past the threshold that is clearly more horizontal than vertical,
 * so vertical page scrolling does not change slides.
 */
export function getSwipeDirection(
  dx: number,
  dy: number,
  threshold: number = HERO_SWIPE_THRESHOLD_PX
): 'next' | 'prev' | null {
  const absX = Math.abs(dx);
  if (absX < threshold) return null;
  if (absX < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'prev';
}

export function shouldAutoplay(state: {
  count: number;
  isPaused: boolean;
  isTabHidden: boolean;
  prefersReducedMotion: boolean;
}): boolean {
  return state.count > 1 && !state.isPaused && !state.isTabHidden && !state.prefersReducedMotion;
}
