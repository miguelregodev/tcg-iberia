/**
 * Product name fuzzy matching service.
 *
 * Combines Jaro-Winkler similarity with token-overlap scoring to find the best
 * catalog product match for an imported product name.
 *
 * Algorithm:
 *  1. Normalize both strings (lowercase, strip punctuation, collapse whitespace).
 *  2. Check for exact match after normalization → score 1.0.
 *  3. Check containment (one string is a substring of the other) → score 0.85–0.95.
 *  4. Compute Jaro-Winkler similarity.
 *  5. Compute Sørensen–Dice token overlap (bigrams of word tokens).
 *  6. Return the maximum of the two scores.
 *
 * The default match threshold is 0.65. Callers can lower it for looser matching.
 */

/** Normalize a product name for comparison. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Jaro similarity ──────────────────────────────────────────────────────────

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matched = new Array<boolean>(len1).fill(false);
  const s2Matched = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(i + matchWindow + 1, len2);
    for (let j = lo; j < hi; j++) {
      if (s2Matched[j] || s1[i] !== s2[j]) continue;
      s1Matched[i] = true;
      s2Matched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matched[i]) continue;
    while (!s2Matched[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

function jaroWinkler(s1: string, s2: string): number {
  const jaroScore = jaro(s1, s2);
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  let prefixLen = 0;
  while (prefixLen < maxPrefix && s1[prefixLen] === s2[prefixLen]) {
    prefixLen++;
  }
  return jaroScore + prefixLen * 0.1 * (1 - jaroScore);
}

// ── Token overlap (Dice coefficient on word tokens) ──────────────────────────

function tokenDice(s1: string, s2: string): number {
  const tokens1 = s1.split(' ').filter(Boolean);
  const tokens2 = s2.split(' ').filter(Boolean);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set2 = new Set(tokens2);
  let common = 0;
  for (const t of tokens1) {
    if (set2.has(t)) common++;
  }
  return (2 * common) / (tokens1.length + tokens2.length);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a similarity score in [0, 1] between two product names.
 * Higher is better; 1.0 is a perfect match.
 */
export function computeSimilarity(importedName: string, productName: string): number {
  const n1 = normalize(importedName);
  const n2 = normalize(productName);

  if (n1 === n2) return 1.0;

  // Containment bonus — shorter name fully contained in longer name
  if (n1.length > 3 && n2.includes(n1)) {
    return 0.85 + 0.1 * (n1.length / n2.length);
  }
  if (n2.length > 3 && n1.includes(n2)) {
    return 0.85 + 0.1 * (n2.length / n1.length);
  }

  const jw = jaroWinkler(n1, n2);
  const dice = tokenDice(n1, n2);
  return Math.max(jw, dice);
}

export interface MatchResult {
  productId: string;
  productName: string;
  score: number;
}

/**
 * Find the best-matching catalog product for an imported name.
 *
 * @param importedName - The raw name from the Google Sheet.
 * @param products     - The catalog products to match against.
 * @param threshold    - Minimum similarity score to consider a valid match (default 0.65).
 * @returns The best match above the threshold, or null if none qualifies.
 */
export function findBestMatch(
  importedName: string,
  products: { id: string; name: string }[],
  threshold = 0.65
): MatchResult | null {
  let best: MatchResult | null = null;

  for (const product of products) {
    const score = computeSimilarity(importedName, product.name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { productId: product.id, productName: product.name, score };
    }
  }

  return best;
}
