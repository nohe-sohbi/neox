import { describe, expect, it } from 'vitest';
const { sanitizeLibrary, mergeLibraries } = require('./library');

describe('sanitizeLibrary', () => {
  it('drops entries with invalid id or media type', () => {
    const out = sanitizeLibrary([
      { id: 550, mediaType: 'movie' },
      { id: 'x', mediaType: 'movie' },
      { id: 1, mediaType: 'person' },
      null,
      42,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 550, mediaType: 'movie' });
  });

  it('clamps personal rating into 1..10 and defaults status', () => {
    const [entry] = sanitizeLibrary([{ id: 1, mediaType: 'tv', personalRating: 99 }]);
    expect(entry.personalRating).toBe(10);
    expect(entry.status).toBe('want');
  });

  it('keeps valid episode progress on shows, drops it on movies', () => {
    const out = sanitizeLibrary([
      { id: 1396, mediaType: 'tv', seenEpisodes: ['1:1', '1:1', '2:8', 'nope', 7] },
      { id: 550, mediaType: 'movie', seenEpisodes: ['1:1'] },
      { id: 66732, mediaType: 'tv', seenEpisodes: [] },
    ]);
    expect(out.find((e) => e.id === 1396).seenEpisodes).toEqual(['1:1', '2:8']);
    expect(out.find((e) => e.id === 550).seenEpisodes).toBeUndefined();
    expect(out.find((e) => e.id === 66732).seenEpisodes).toBeUndefined();
  });

  it('accepts all three statuses and falls back on an unknown one', () => {
    const out = sanitizeLibrary([
      { id: 1, mediaType: 'tv', status: 'want' },
      { id: 2, mediaType: 'tv', status: 'watching' },
      { id: 3, mediaType: 'tv', status: 'watched' },
      { id: 4, mediaType: 'tv', status: 'dropped' },
    ]);
    expect(out.map((e) => e.status)).toEqual(['want', 'watching', 'watched', 'want']);
  });

  it('keeps a trimmed note, bounded, and drops an empty or non-string one', () => {
    const out = sanitizeLibrary([
      { id: 1, mediaType: 'movie', note: '  Vu au cinéma avec Léa.  ' },
      { id: 2, mediaType: 'movie', note: '   ' },
      { id: 3, mediaType: 'movie', note: 42 },
      { id: 4, mediaType: 'movie', note: 'x'.repeat(5000) },
    ]);
    expect(out.find((e) => e.id === 1).note).toBe('Vu au cinéma avec Léa.');
    expect(out.find((e) => e.id === 2).note).toBeUndefined();
    expect(out.find((e) => e.id === 3).note).toBeUndefined();
    expect(out.find((e) => e.id === 4).note).toHaveLength(1000);
  });

  it('keeps a plausible runtime and drops an implausible one', () => {
    const out = sanitizeLibrary([
      { id: 1, mediaType: 'movie', runtime: 139.4 },
      { id: 2, mediaType: 'movie', runtime: -5 },
      { id: 3, mediaType: 'movie', runtime: 'long' },
      { id: 4, mediaType: 'movie', runtime: 99999 },
    ]);
    expect(out.find((e) => e.id === 1).runtime).toBe(139);
    expect(out.find((e) => e.id === 2).runtime).toBeUndefined();
    expect(out.find((e) => e.id === 3).runtime).toBeUndefined();
    expect(out.find((e) => e.id === 4).runtime).toBe(2000);
  });

  it('dedupes by media key, last one wins', () => {
    const out = sanitizeLibrary([
      { id: 5, mediaType: 'movie', title: 'A' },
      { id: 5, mediaType: 'movie', title: 'B' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('B');
  });
});

describe('mergeLibraries', () => {
  it('unions both sides and keeps the most recently updated entry', () => {
    const server = [{ id: 1, mediaType: 'movie', status: 'want', updatedAt: 1, addedAt: 1 }];
    const local = [
      { id: 1, mediaType: 'movie', status: 'watched', updatedAt: 5, addedAt: 1 },
      { id: 2, mediaType: 'tv', status: 'want', updatedAt: 2, addedAt: 2 },
    ];
    const merged = mergeLibraries(server, local);
    expect(merged).toHaveLength(2);
    const one = merged.find((e) => e.id === 1);
    expect(one.status).toBe('watched');
  });
});
