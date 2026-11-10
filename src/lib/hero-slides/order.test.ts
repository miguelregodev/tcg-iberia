import { describe, expect, it } from 'vitest';
import { isPermutationOf, moveToPosition } from './order';

describe('moveToPosition', () => {
  it('moves an id to the requested position', () => {
    expect(moveToPosition(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveToPosition(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('clamps positions outside the range', () => {
    expect(moveToPosition(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a']);
    expect(moveToPosition(['a', 'b', 'c'], 'c', -4)).toEqual(['c', 'a', 'b']);
  });

  it('returns a copy unchanged when no position is given', () => {
    const ids = ['a', 'b'];
    const result = moveToPosition(ids, 'a');
    expect(result).toEqual(['a', 'b']);
    expect(result).not.toBe(ids);
  });

  it('does not mutate the input', () => {
    const ids = ['a', 'b', 'c'];
    moveToPosition(ids, 'c', 0);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('isPermutationOf', () => {
  it('accepts a reordering of the same ids', () => {
    expect(isPermutationOf(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('rejects missing, extra, or duplicated ids', () => {
    expect(isPermutationOf(['a', 'b'], ['a'])).toBe(false);
    expect(isPermutationOf(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(isPermutationOf(['a', 'b'], ['a', 'a'])).toBe(false);
  });
});
