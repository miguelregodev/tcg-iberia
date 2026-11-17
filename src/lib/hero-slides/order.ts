/**
 * Pure ordering helpers. Positions are zero-based and always normalized to 0..n-1.
 */

/**
 * Returns a new id list with `id` moved to `position` (clamped to the valid range).
 * When `position` is undefined, or `id` is not present, the list is returned unchanged.
 */
export function moveToPosition(ids: readonly string[], id: string, position?: number): string[] {
  if (position === undefined || !Number.isInteger(position)) {
    return [...ids];
  }
  const current = ids.indexOf(id);
  if (current === -1) {
    return [...ids];
  }
  const rest = ids.filter((item) => item !== id);
  const target = Math.min(Math.max(position, 0), rest.length);
  rest.splice(target, 0, id);
  return rest;
}

/** True when `candidate` contains every id in `expected` exactly once and nothing else. */
export function isPermutationOf(expected: readonly string[], candidate: readonly string[]): boolean {
  if (expected.length !== candidate.length) return false;
  const expectedSet = new Set(expected);
  if (expectedSet.size !== expected.length) return false;
  const seen = new Set<string>();
  for (const id of candidate) {
    if (!expectedSet.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
