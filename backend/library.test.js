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

  it('accepts all three statuses and falls back on an unknown one', () => {
    const out = sanitizeLibrary([
      { id: 1, mediaType: 'tv', status: 'want' },
      { id: 2, mediaType: 'tv', status: 'watching' },
      { id: 3, mediaType: 'tv', status: 'watched' },
      { id: 4, mediaType: 'tv', status: 'dropped' },
    ]);
    expect(out.map((e) => e.status)).toEqual(['want', 'watching', 'watched', 'want']);
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
