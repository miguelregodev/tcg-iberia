import { describe, expect, it } from 'vitest';

import {
  filterAndRankProducts,
  normalizeSearchText,
  parseSearchLimit,
  parseSearchOffset,
  rankSearchMatches,
  tokenize,
  LIVE_SEARCH_LIMIT,
  SEARCH_MAX_LIMIT,
} from './search';

type FakeProduct = {
  id: string;
  name: string;
  type: string | null;
  description: string;
  priority: number;
};

const baseProducts: FakeProduct[] = [
  {
    id: 'p1',
    name: 'Pokemon Booster Box',
    type: 'Booster Box',
    description: 'A sealed display of booster packs.',
    priority: 1,
  },
  {
    id: 'p2',
    name: 'Booster Pokemon Box',
    type: 'Booster Box',
    description: 'Localized variant.',
    priority: 5,
  },
  {
    id: 'p3',
    name: 'Scarlet Booster Elite Box',
    type: 'Elite Trainer Box',
    description: 'ETB.',
    priority: 3,
  },
  {
    id: 'p4',
    name: 'Japanese Booster Box',
    type: 'Booster Box',
    description: 'Imported from Japan.',
    priority: 2,
  },
  {
    id: 'p5',
    name: 'Random Pikachu Plush',
    type: 'Merch',
    description: 'Soft toy.',
    priority: 1,
  },
];

describe('normalizeSearchText', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalizeSearchText('Japonés Booster Box')).toBe('japones booster box');
  });

  it('collapses punctuation to single spaces', () => {
    expect(normalizeSearchText('  Hello,  WORLD! ')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeSearchText('')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits and deduplicates tokens', () => {
    expect(tokenize('Booster booster Box')).toEqual(['booster', 'box']);
  });

  it('returns [] for empty/blank input', () => {
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('filterAndRankProducts', () => {
  it('matches products regardless of word order', () => {
    const matches = filterAndRankProducts(baseProducts, 'booster box');
    const ids = matches.map((p) => p.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
    expect(ids).toContain('p3');
    expect(ids).toContain('p4');
    expect(ids).not.toContain('p5');
  });

  it('is case- and diacritic-insensitive', () => {
    const accented: FakeProduct[] = [
      {
        id: 'jp',
        name: 'Japonés Booster Box',
        type: 'Booster Box',
        description: 'Importado de Japón.',
        priority: 1,
      },
    ];
    const matches = filterAndRankProducts(accented, 'japones');
    expect(matches.some((p) => p.id === 'jp')).toBe(true);
  });

  it('returns empty array for empty query', () => {
    expect(filterAndRankProducts(baseProducts, '')).toEqual([]);
  });

  it('respects priority as the primary sort key', () => {
    const matches = filterAndRankProducts(baseProducts, 'booster box');
    // p1 has priority 1, must be first.
    expect(matches[0]?.id).toBe('p1');
    // p4 has priority 2, must come before p3 (priority 3) and p2 (priority 5).
    const remaining = matches.slice(1).map((p) => p.id);
    expect(remaining[0]).toBe('p4');
  });
});

describe('rankSearchMatches relevance', () => {
  it('uses relevance to break ties when priority is equal', () => {
    const sameWithPriority: FakeProduct[] = [
      { id: 'a', name: 'Storm Surge Booster Box', type: 'Booster Box', description: '', priority: 7 },
      { id: 'b', name: 'Prismatic Storm ETB', type: 'Elite Trainer Box', description: '', priority: 7 },
      { id: 'c', name: 'Silver Storm Pack', type: 'Booster Pack', description: '', priority: 7 },
    ];
    const ranked = rankSearchMatches(sameWithPriority, tokenize('storm'));
    // All have equal priority — order falls back to score, then name.
    // 'Storm Surge Booster Box' starts with the token → highest relevance.
    expect(ranked[0]?.id).toBe('a');
  });
});

describe('parseSearchLimit / parseSearchOffset', () => {
  it('falls back to defaults for invalid input', () => {
    expect(parseSearchLimit(null, LIVE_SEARCH_LIMIT)).toBe(LIVE_SEARCH_LIMIT);
    expect(parseSearchLimit('abc', 7)).toBe(7);
    expect(parseSearchLimit('-5', 7)).toBe(7);
  });

  it('clamps limit to the configured maximum', () => {
    expect(parseSearchLimit(String(SEARCH_MAX_LIMIT + 100), 5)).toBe(SEARCH_MAX_LIMIT);
  });

  it('returns 0 for invalid offsets', () => {
    expect(parseSearchOffset(null)).toBe(0);
    expect(parseSearchOffset('-1')).toBe(0);
    expect(parseSearchOffset('abc')).toBe(0);
    expect(parseSearchOffset('42')).toBe(42);
  });
});
