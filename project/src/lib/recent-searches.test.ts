import { describe, expect, it } from 'vitest';
import { MAX_RECENT, addSearch, normalizeQuery } from './recent-searches';

describe('normalizeQuery', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeQuery('  dune   2 ')).toBe('dune 2');
    expect(normalizeQuery('\tinterstellar\n')).toBe('interstellar');
  });
});

describe('addSearch', () => {
  it('prepends a new query', () => {
    expect(addSearch(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('promotes an existing query to the front, de-duplicated case-insensitively', () => {
    expect(addSearch(['a', 'Dune', 'b'], 'dune')).toEqual(['dune', 'a', 'b']);
  });

  it('ignores empty/whitespace-only queries', () => {
    expect(addSearch(['a'], '   ')).toEqual(['a']);
    expect(addSearch(['a'], '')).toEqual(['a']);
  });

  it('caps the list length', () => {
    const long = ['1', '2', '3', '4', '5', '6'];
    const next = addSearch(long, 'new');
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0]).toBe('new');
    expect(next).not.toContain('6');
  });

  it('normalizes before storing', () => {
    expect(addSearch([], '  the   matrix ')).toEqual(['the matrix']);
  });
});
