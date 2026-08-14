import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_LENGTH,
  entryKey,
  episodeCode,
  matchesQuery,
  normalizeNote,
  sanitizeSeenEpisodes,
  toEntry,
  toggleEntry,
  toggleEpisodeCode,
  upsertEntry,
} from './library-utils';
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

describe('episode progress helpers', () => {
  it('builds stable season:episode codes', () => {
    expect(episodeCode(2, 5)).toBe('2:5');
    expect(episodeCode(0, 1)).toBe('0:1'); // specials
  });

  it('toggles a code in and out, collapsing to undefined when empty', () => {
    const one = toggleEpisodeCode(undefined, '1:1');
    expect(one).toEqual(['1:1']);
    const two = toggleEpisodeCode(one, '1:2');
    expect(two).toContain('1:2');
    expect(toggleEpisodeCode(['1:1'], '1:1')).toBeUndefined();
  });

  it('sanitizes untrusted lists: bad codes out, duplicates collapsed', () => {
    expect(
      sanitizeSeenEpisodes(['1:1', '1:1', '2:10', 'lol', '1-2', ':3', 42, null]),
    ).toEqual(['1:1', '2:10']);
    expect(sanitizeSeenEpisodes([])).toBeUndefined();
    expect(sanitizeSeenEpisodes('1:1')).toBeUndefined();
  });

  it('bounds the list size', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => `1:${i + 1}`);
    expect(sanitizeSeenEpisodes(huge)!.length).toBeLessThanOrEqual(2000);
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

describe('matchesQuery over notes', () => {
  it('matches a note as well as a title', () => {
    const entry = { title: 'Fight Club', note: 'Vu au cinéma avec Léa' };
    expect(matchesQuery(entry, 'léa')).toBe(true);
    expect(matchesQuery(entry, 'lea')).toBe(true); // accent-insensitive both ways
    expect(matchesQuery(entry, 'cinema')).toBe(true);
    expect(matchesQuery(entry, 'introuvable')).toBe(false);
  });

  it('still works on an entry that carries no note', () => {
    expect(matchesQuery({ title: 'Fight Club' }, 'fight')).toBe(true);
    expect(matchesQuery({ title: 'Fight Club' }, 'note')).toBe(false);
  });
});

describe('normalizeNote', () => {
  it('trims, bounds, and treats blank as no note at all', () => {
    expect(normalizeNote('  à revoir  ')).toBe('à revoir');
    expect(normalizeNote('   ')).toBeUndefined();
    expect(normalizeNote('')).toBeUndefined();
    expect(normalizeNote('x'.repeat(2000))).toHaveLength(MAX_NOTE_LENGTH);
  });
});

describe('toEntry runtime capture', () => {
  it('records a runtime when the source carries one (a fiche does)', () => {
    expect(toEntry({ ...movie, runtime: 139 }).runtime).toBe(139);
  });

  it('leaves it absent for a card, which has no runtime to give', () => {
    expect(toEntry(movie).runtime).toBeUndefined();
    expect(toEntry({ ...movie, runtime: null }).runtime).toBeUndefined();
  });
});
