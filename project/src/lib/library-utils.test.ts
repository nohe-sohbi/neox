import { describe, expect, it } from 'vitest';
import { entryKey, matchesQuery, toEntry, toggleEntry, upsertEntry } from './library-utils';
import type { MediaItem } from './types';

const movie: MediaItem = {
  id: 550,
  mediaType: 'movie',
  title: 'Fight Club',
  originalTitle: 'Fight Club',
  overview: '',
  poster: '/p.jpg',
  backdrop: null,
  year: '1999',
  rating: 8.4,
  voteCount: 100,
  popularity: 50,
};

describe('entryKey', () => {
  it('namespaces by media type', () => {
    expect(entryKey({ id: 1, mediaType: 'movie' })).toBe('movie:1');
    expect(entryKey({ id: 1, mediaType: 'tv' })).toBe('tv:1');
  });
});

describe('toEntry', () => {
  it('defaults to "want" with no personal rating', () => {
    const e = toEntry(movie);
    expect(e).toMatchObject({ id: 550, status: 'want', personalRating: null, title: 'Fight Club' });
    expect(e.addedAt).toBeTypeOf('number');
  });

  it('applies overrides', () => {
    expect(toEntry(movie, { status: 'watched', personalRating: 9 })).toMatchObject({
      status: 'watched',
      personalRating: 9,
    });
  });
});

describe('toggleEntry', () => {
  it('adds when absent and removes when present', () => {
    const added = toggleEntry([], movie);
    expect(added).toHaveLength(1);
    expect(toggleEntry(added, movie)).toHaveLength(0);
  });
});

describe('matchesQuery', () => {
  it('matches everything on an empty or whitespace query', () => {
    expect(matchesQuery({ title: 'Fight Club' }, '')).toBe(true);
    expect(matchesQuery({ title: 'Fight Club' }, '   ')).toBe(true);
  });

  it('is case-insensitive and matches substrings', () => {
    expect(matchesQuery({ title: 'Fight Club' }, 'fight')).toBe(true);
    expect(matchesQuery({ title: 'Fight Club' }, 'CLUB')).toBe(true);
    expect(matchesQuery({ title: 'Fight Club' }, 'monk')).toBe(false);
  });

  it('ignores accents in both directions', () => {
    expect(matchesQuery({ title: 'Le Fabuleux Destin d’Amélie Poulain' }, 'amelie')).toBe(true);
    expect(matchesQuery({ title: 'Leon' }, 'léon')).toBe(true);
  });
});

describe('upsertEntry', () => {
  it('inserts a new entry', () => {
    expect(upsertEntry([], movie, { status: 'watched' })[0].status).toBe('watched');
  });

  it('patches an existing entry without duplicating it', () => {
    const seeded = toggleEntry([], movie);
    const next = upsertEntry(seeded, movie, { personalRating: 7 });
    expect(next).toHaveLength(1);
    expect(next[0].personalRating).toBe(7);
  });
});
