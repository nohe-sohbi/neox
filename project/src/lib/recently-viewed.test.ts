import { describe, expect, it } from 'vitest';
import { MAX_RECENT_VIEWED, addRecent, toMediaItem, type RecentItem } from './recently-viewed';

const item = (id: number, mediaType: 'movie' | 'tv' = 'movie'): RecentItem => ({
  id,
  mediaType,
  title: `Title ${id}`,
  poster: null,
  year: '2024',
  rating: 7,
});

describe('addRecent', () => {
  it('prepends a freshly viewed title', () => {
    const next = addRecent([item(1)], item(2));
    expect(next.map((x) => x.id)).toEqual([2, 1]);
  });

  it('promotes an already-seen title to the front (no duplicates)', () => {
    const next = addRecent([item(1), item(2), item(3)], item(3));
    expect(next.map((x) => x.id)).toEqual([3, 1, 2]);
  });

  it('treats movie and tv with the same id as distinct', () => {
    const next = addRecent([item(5, 'movie')], item(5, 'tv'));
    expect(next).toHaveLength(2);
    expect(next.map((x) => x.mediaType)).toEqual(['tv', 'movie']);
  });

  it('caps the list at the max length', () => {
    let list: RecentItem[] = [];
    for (let i = 0; i < MAX_RECENT_VIEWED + 5; i++) list = addRecent(list, item(i));
    expect(list).toHaveLength(MAX_RECENT_VIEWED);
    expect(list[0].id).toBe(MAX_RECENT_VIEWED + 4); // newest first
  });

  it('does not mutate the input list', () => {
    const input = [item(1)];
    addRecent(input, item(2));
    expect(input.map((x) => x.id)).toEqual([1]);
  });
});

describe('toMediaItem', () => {
  it('pads a compact record into a full MediaItem', () => {
    const media = toMediaItem(item(42, 'tv'));
    expect(media).toMatchObject({ id: 42, mediaType: 'tv', title: 'Title 42', voteCount: 0 });
  });
});
