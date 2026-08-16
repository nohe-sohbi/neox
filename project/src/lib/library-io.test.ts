import { describe, expect, it } from 'vitest';
import {
  EXPORT_VERSION,
  csvFilename,
  mergeEntries,
  parseLibrary,
  serializeLibrary,
  serializeLibraryCsv,
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

  it('round-trips episode progress on shows and drops it on movies', () => {
    const parsed = parseLibrary(
      JSON.stringify([
        { id: 1396, mediaType: 'tv', seenEpisodes: ['1:1', '1:2', 'junk'] },
        { id: 550, mediaType: 'movie', seenEpisodes: ['1:1'] },
      ]),
    );
    expect(parsed.find((e) => e.id === 1396)?.seenEpisodes).toEqual(['1:1', '1:2']);
    expect(parsed.find((e) => e.id === 550)?.seenEpisodes).toBeUndefined();
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

  it('round-trips a note and a runtime, and rejects unusable ones', () => {
    const restored = parseLibrary(
      serializeLibrary([
        make({ id: 1, note: '  À revoir en VO  ', runtime: 139 }),
        make({ id: 2, note: '   ', runtime: -3 }),
      ]),
    );
    const first = restored.find((e) => e.id === 1);
    const second = restored.find((e) => e.id === 2);
    expect(first?.note).toBe('À revoir en VO');
    expect(first?.runtime).toBe(139);
    expect(second?.note).toBeUndefined();
    expect(second?.runtime).toBeUndefined();
  });

  it('bounds an oversized note from an untrusted backup', () => {
    const [entry] = parseLibrary(JSON.stringify([{ id: 5, mediaType: 'movie', note: 'x'.repeat(9000) }]));
    expect(entry.note).toHaveLength(1000);
  });

  it('throws typed errors for unusable input', () => {
    expect(() => parseLibrary('not json')).toThrowError(/json/i);
    expect(() => parseLibrary('{"foo":1}')).toThrowError();
    expect(() => parseLibrary('[]')).toThrowError(); // no valid entries
  });
});

describe('serializeLibraryCsv', () => {
  it('starts with a BOM and a header row, CRLF-terminated', () => {
    const csv = serializeLibraryCsv([make({})]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'title,type,year,status,personal_rating,tmdb_rating,seen_episodes,note,runtime_minutes,added_at,updated_at',
    );
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('escapes commas and quotes per RFC 4180', () => {
    const csv = serializeLibraryCsv([make({ title: 'Bonnie "and" Clyde, maybe' })]);
    expect(csv).toContain('"Bonnie ""and"" Clyde, maybe"');
  });

  it('renders ratings, episode counts, note, runtime and ISO dates', () => {
    const csv = serializeLibraryCsv([
      make({
        mediaType: 'tv',
        status: 'watching',
        personalRating: 8,
        rating: 7.5,
        seenEpisodes: ['1:1', '1:2'],
        note: 'À revoir',
        runtime: 47,
        addedAt: Date.UTC(2026, 0, 2),
        updatedAt: Date.UTC(2026, 0, 3),
      }),
    ]);
    const row = csv.trim().split('\r\n')[1];
    expect(row).toBe(
      'A,tv,2000,watching,8,7.5,2,À revoir,47,2026-01-02T00:00:00.000Z,2026-01-03T00:00:00.000Z',
    );
  });

  it('quotes a note that carries commas or newlines instead of losing it', () => {
    const csv = serializeLibraryCsv([make({ note: 'Vu au ciné, deux fois\nà revoir' })]);
    expect(csv).toContain('"Vu au ciné, deux fois\nà revoir"');
  });

  it('leaves missing ratings empty instead of writing null', () => {
    const csv = serializeLibraryCsv([make({ personalRating: null, rating: null })]);
    expect(csv).not.toContain('null');
  });

  it('suggests a dated .csv filename', () => {
    expect(csvFilename(new Date(Date.UTC(2026, 7, 12)))).toBe('neox-library-2026-08-12.csv');
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
