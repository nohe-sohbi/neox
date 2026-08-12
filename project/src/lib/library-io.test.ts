import { describe, expect, it } from 'vitest';
import {
  EXPORT_VERSION,
  mergeEntries,
  parseLibrary,
  serializeLibrary,
  sortEntries,
} from './library-io';
import type { LibraryEntry } from './types';

const make = (over: Partial<LibraryEntry>): LibraryEntry => ({
  id: 1,
  mediaType: 'movie',
  title: 'A',
  poster: null,
  year: '2000',
  rating: 5,
  status: 'want',
  personalRating: null,
  addedAt: 1,
  updatedAt: 1,
  ...over,
});

describe('serializeLibrary / parseLibrary', () => {
  it('round-trips a library through a versioned backup', () => {
    const entries = [make({ id: 550, title: 'Fight Club', status: 'watched', personalRating: 9 })];
    const json = serializeLibrary(entries);
    const doc = JSON.parse(json);
    expect(doc.app).toBe('neox');
    expect(doc.version).toBe(EXPORT_VERSION);
    expect(doc.count).toBe(1);

    const parsed = parseLibrary(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: 550, status: 'watched', personalRating: 9 });
  });

  it('accepts a bare entry array and drops invalid entries', () => {
    const json = JSON.stringify([
      { id: 5, mediaType: 'movie', title: 'Ok' },
      { id: 0, mediaType: 'movie' }, // invalid id
      { id: 7, mediaType: 'banana' }, // invalid media type
    ]);
    const parsed = parseLibrary(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(5);
  });

  it('clamps a personal rating into 1..10', () => {
    const [entry] = parseLibrary(
      JSON.stringify([{ id: 5, mediaType: 'tv', personalRating: 42 }]),
    );
    expect(entry.personalRating).toBe(10);
  });

  it('preserves the watching status and rejects unknown ones', () => {
    const parsed = parseLibrary(
      JSON.stringify([
        { id: 5, mediaType: 'tv', status: 'watching' },
        { id: 6, mediaType: 'tv', status: 'paused' },
      ]),
    );
    expect(parsed.find((e) => e.id === 5)?.status).toBe('watching');
    expect(parsed.find((e) => e.id === 6)?.status).toBe('want');
  });

  it('de-duplicates by media-type + id', () => {
    const json = JSON.stringify([
      { id: 5, mediaType: 'movie', title: 'first' },
      { id: 5, mediaType: 'movie', title: 'second' },
    ]);
    expect(parseLibrary(json)).toHaveLength(1);
  });

  it('throws typed errors for unusable input', () => {
    expect(() => parseLibrary('not json')).toThrowError(/json/i);
    expect(() => parseLibrary('{"foo":1}')).toThrowError();
    expect(() => parseLibrary('[]')).toThrowError(); // no valid entries
  });
});

describe('mergeEntries', () => {
  it('unions and keeps the most recently updated on conflict', () => {
    const current = [make({ id: 1, title: 'old', updatedAt: 10 })];
    const incoming = [
      make({ id: 1, title: 'new', updatedAt: 20 }),
      make({ id: 2, title: 'fresh', updatedAt: 5 }),
    ];
    const merged = mergeEntries(current, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.id === 1)?.title).toBe('new');
  });
});

describe('sortEntries', () => {
  const a = make({ id: 1, title: 'Zardoz', addedAt: 1, rating: 6, personalRating: 3, year: '1974' });
  const b = make({ id: 2, title: 'Akira', addedAt: 3, rating: 8, personalRating: 9, year: '1988' });
  const c = make({ id: 3, title: 'Matrix', addedAt: 2, rating: 7, personalRating: null, year: '1999' });
  const list = [a, b, c];

  it('sorts by recency, title, ratings and year', () => {
    expect(sortEntries(list, 'added_desc').map((e) => e.id)).toEqual([2, 3, 1]);
    expect(sortEntries(list, 'added_asc').map((e) => e.id)).toEqual([1, 3, 2]);
    expect(sortEntries(list, 'title_asc').map((e) => e.title)).toEqual(['Akira', 'Matrix', 'Zardoz']);
    expect(sortEntries(list, 'rating_desc').map((e) => e.id)).toEqual([2, 3, 1]);
    expect(sortEntries(list, 'personal_desc')[0].id).toBe(2);
    expect(sortEntries(list, 'year_desc').map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it('does not mutate the input array', () => {
    const copy = [...list];
    sortEntries(list, 'title_asc');
    expect(list).toEqual(copy);
  });
});
