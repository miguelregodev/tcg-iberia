import { describe, expect, it } from 'vitest';
import {
  HERO_AUTOPLAY_INTERVAL_MS,
  getNextIndex,
  getPrevIndex,
  getSwipeDirection,
  shouldAutoplay,
} from './carousel';

describe('carousel helpers', () => {
  it('wraps next and previous indexes', () => {
    expect(getNextIndex(0, 3)).toBe(1);
    expect(getNextIndex(2, 3)).toBe(0);
    expect(getPrevIndex(0, 3)).toBe(2);
    expect(getPrevIndex(1, 3)).toBe(0);
  });

  it('returns 0 for empty slide lists', () => {
    expect(getNextIndex(0, 0)).toBe(0);
    expect(getPrevIndex(0, 0)).toBe(0);
  });

  it('maps horizontal swipes to directions past the threshold', () => {
    expect(getSwipeDirection(-120, 10)).toBe('next');
    expect(getSwipeDirection(120, -10)).toBe('prev');
  });

  it('ignores short or mostly vertical gestures', () => {
    expect(getSwipeDirection(-20, 0)).toBeNull();
    expect(getSwipeDirection(-100, 90)).toBeNull();
  });

  it('autoplays only when there are multiple slides and motion is allowed', () => {
    const base = { count: 3, isPaused: false, isTabHidden: false, prefersReducedMotion: false };
    expect(shouldAutoplay(base)).toBe(true);
    expect(shouldAutoplay({ ...base, count: 1 })).toBe(false);
    expect(shouldAutoplay({ ...base, isPaused: true })).toBe(false);
    expect(shouldAutoplay({ ...base, isTabHidden: true })).toBe(false);
    expect(shouldAutoplay({ ...base, prefersReducedMotion: true })).toBe(false);
  });

  it('uses a 5 second interval', () => {
    expect(HERO_AUTOPLAY_INTERVAL_MS).toBe(5000);
  });
});
