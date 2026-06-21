import type { Product } from '@/types';

/**
 * Live-search payload returned by `/api/search`.
 */
export interface SearchResponse {
  /** Top N matches, already ranked by priority → relevance → name. */
  products: Product[];
  /** Total matches in the catalog (used to decide whether to show "View all"). */
  total: number;
  /** Echo of the requested limit so the client knows what it got. */
  limit: number;
  /** Echo of the requested offset (0 when not paginating). */
  offset: number;
  /** Tokenized query for debugging / future highlighting. */
  tokens: string[];
}

/** Minimum characters required before we run any search query. */
export const SEARCH_MIN_QUERY_LENGTH = 1;

/** Number of results shown in the header live-search dropdown. */
export const LIVE_SEARCH_LIMIT = 5;

/** Hard cap on results the search API will ever return per request. */
export const SEARCH_MAX_LIMIT = 100;

/**
 * Normalise a string for tokenized matching:
 * - lowercase
 * - strip diacritics ("japonés" → "japones")
 * - replace any non-alphanumeric run with a single space
 * - trim
 */
export function normalizeSearchText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Split a query (or any text) into unique, normalised tokens.
 * Empty input returns an empty array.
 */
export function tokenize(input: string): string[] {
  const normalized = normalizeSearchText(input);
  if (!normalized) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const piece of normalized.split(' ')) {
    if (!piece) continue;
    if (seen.has(piece)) continue;
    seen.add(piece);
    tokens.push(piece);
  }
  return tokens;
}

/**
 * Searchable representation of a product. Only the fields we actually want
 * to match against are kept, so this is cheap to compute.
 */
interface SearchableProduct {
  name: string;
  type: string;
  description: string;
  /** Concatenation of every searchable field – pre-normalised. */
  haystack: string;
  nameTokens: Set<string>;
}

function buildSearchable(product: Pick<Product, 'name' | 'type' | 'description'>): SearchableProduct {
  const name = normalizeSearchText(product.name);
  const type = normalizeSearchText(product.type ?? '');
  const description = normalizeSearchText(product.description ?? '');
  const haystack = `${name} ${type} ${description}`.trim();
  const nameTokens = new Set(name.split(' ').filter(Boolean));
  return { name, type, description, haystack, nameTokens };
}

/**
 * Returns true when every query token appears as a substring in the product's
 * searchable text. This is order-insensitive — `"booster box"` matches
 * `"Scarlet Booster Elite Box"` and `"Booster Pokemon Box"` alike.
 */
function matchesAllTokens(searchable: SearchableProduct, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  for (const token of tokens) {
    if (!searchable.haystack.includes(token)) return false;
  }
  return true;
}

/**
 * Compute a relevance score for a product against the query tokens.
 * Higher is better. Used only as a tie-breaker after `priority`.
 *
 * Scoring (per token):
 * - exact match of the full product name        → 1000
 * - product name starts with the token          →  120
 * - token is a whole word in the product name   →  100
 * - token appears anywhere in the product name  →   60
 * - token appears in the product type           →   25
 * - token appears in the description            →   10
 *
 * Additional bonuses:
 * - all tokens hit the name                     →  +40
 * - shorter names rank slightly higher (tiny tie-breaker)
 */
function scoreProduct(searchable: SearchableProduct, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  let score = 0;
  let allTokensInName = true;

  const fullQuery = tokens.join(' ');
  if (searchable.name === fullQuery) {
    score += 1000;
  }

  for (const token of tokens) {
    const inName = searchable.name.includes(token);
    if (!inName) allTokensInName = false;

    if (searchable.name.startsWith(`${token} `) || searchable.name === token) {
      score += 120;
    }
    if (searchable.nameTokens.has(token)) {
      score += 100;
    } else if (inName) {
      score += 60;
    }
    if (!inName && searchable.type.includes(token)) {
      score += 25;
    }
    if (!inName && searchable.description.includes(token)) {
      score += 10;
    }
  }

  if (allTokensInName) score += 40;

  // Very small tie-breaker: prefer concise names.
  score += Math.max(0, 30 - searchable.name.length) * 0.1;

  return score;
}

interface RankableProduct extends Pick<Product, 'name' | 'type' | 'description' | 'priority'> {
  // Allow extra fields — we just pass the whole Product through.
}

/**
 * Stable, deterministic sort used everywhere search results need ordering.
 * Primary:   product priority (ASC — lower = higher priority).
 * Secondary: relevance score (DESC).
 * Tertiary:  product name (ASC, locale-aware).
 */
export function rankSearchMatches<T extends RankableProduct>(
  products: T[],
  tokens: string[],
): Array<T & { __searchScore: number }> {
  const decorated = products.map((product) => {
    const searchable = buildSearchable(product);
    return {
      product,
      score: scoreProduct(searchable, tokens),
      name: searchable.name,
    };
  });

  decorated.sort((a, b) => {
    if (a.product.priority !== b.product.priority) {
      return a.product.priority - b.product.priority;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  });

  return decorated.map(({ product, score }) =>
    Object.assign({}, product, { __searchScore: score }),
  );
}

/**
 * Convenience helper for client-side fallbacks / tests: filter a list of
 * products by the tokenized search rules and return them ranked.
 */
export function filterAndRankProducts<T extends RankableProduct>(
  products: T[],
  query: string,
): T[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const matching = products.filter((product) =>
    matchesAllTokens(buildSearchable(product), tokens),
  );
  return rankSearchMatches(matching, tokens).map(
    ({ __searchScore: _ignored, ...rest }) => rest as unknown as T,
  );
}

/**
 * Clamp an arbitrary `limit` query string to the supported range.
 * Falls back to `defaultLimit` when invalid.
 */
export function parseSearchLimit(raw: string | null, defaultLimit: number): number {
  if (!raw) return defaultLimit;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(parsed, SEARCH_MAX_LIMIT);
}

/**
 * Clamp an arbitrary `offset` query string to a non-negative integer.
 */
export function parseSearchOffset(raw: string | null): number {
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}
