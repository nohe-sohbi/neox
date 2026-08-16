import { describe, expect, it } from 'vitest';
import { computeStats, formatWatchTime } from './library-stats';
import type { LibraryEntry, LibraryStatus, MediaType } from './types';

let seq = 0;
function entry(patch: Partial<LibraryEntry> = {}): LibraryEntry {
  seq += 1;
  return {
    id: seq,
    mediaType: 'movie' as MediaType,
    title: `Title ${seq}`,
    poster: null,
    year: '2020',
    rating: 7,
    status: 'want' as LibraryStatus,
    personalRating: null,
    addedAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

describe('computeStats', () => {
  it('returns a zeroed shape for an empty library', () => {
    const s = computeStats([]);
    expect(s).toMatchObject({
      total: 0,
      want: 0,
      watching: 0,
      watched: 0,
      movies: 0,
      tv: 0,
      completionRate: 0,
      ratedCount: 0,
      avgPersonalRating: null,
      avgTmdbRating: null,
      topDecades: [],
    });
    expect(s.ratingDistribution).toHaveLength(10);
  });

  it('counts status, media type and completion', () => {
    const s = computeStats([
      entry({ status: 'watched', mediaType: 'movie' }),
      entry({ status: 'watched', mediaType: 'tv' }),
      entry({ status: 'watching', mediaType: 'tv' }),
      entry({ status: 'want', mediaType: 'tv' }),
      entry({ status: 'want', mediaType: 'movie' }),
    ]);
    expect(s.total).toBe(5);
    expect(s.watched).toBe(2);
    expect(s.watching).toBe(1);
    expect(s.want).toBe(2);
    expect(s.movies).toBe(2);
    expect(s.tv).toBe(3);
    expect(s.completionRate).toBe(0.4);
  });

  it('averages personal and TMDB ratings, ignoring missing ones', () => {
    const s = computeStats([
      entry({ personalRating: 8, rating: 7 }),
      entry({ personalRating: 6, rating: 9 }),
      entry({ personalRating: null, rating: null }),
    ]);
    expect(s.ratedCount).toBe(2);
    expect(s.avgPersonalRating).toBe(7); // (8+6)/2
    expect(s.avgTmdbRating).toBe(8); // (7+9)/2
  });

  it('measures how far personal ratings sit from the TMDB crowd', () => {
    const s = computeStats([
      entry({ personalRating: 9, rating: 7 }), // +2
      entry({ personalRating: 6, rating: 7 }), // -1
      entry({ personalRating: 8, rating: null }), // no pair → excluded
      entry({ personalRating: null, rating: 6 }), // no pair → excluded
    ]);
    expect(s.personalVsTmdb).toBe(0.5); // (+2 - 1) / 2

    expect(computeStats([entry({ personalRating: 8, rating: null })]).personalVsTmdb).toBeNull();
  });

  it('buckets personal ratings into a 1..10 histogram', () => {
    const s = computeStats([
      entry({ personalRating: 1 }),
      entry({ personalRating: 10 }),
      entry({ personalRating: 10 }),
    ]);
    expect(s.ratingDistribution[0]).toBe(1); // rating 1
    expect(s.ratingDistribution[9]).toBe(2); // rating 10
  });

  it('counts watch time only where a runtime is actually known', () => {
    const s = computeStats([
      entry({ status: 'watched', runtime: 120 }), // counted
      entry({ status: 'watched' }), // no runtime → unknown, not zero
      entry({ status: 'want', runtime: 200 }), // not watched → not time spent
    ]);
    expect(s.watchTimeMinutes).toBe(120);
    expect(s.watchTimeCoverage).toBe(1);
  });

  it('counts a show by its ticked episodes, not by its status', () => {
    const s = computeStats([
      entry({ mediaType: 'tv', status: 'watching', runtime: 45, seenEpisodes: ['1:1', '1:2'] }),
      // "Watched" with nothing ticked says nothing about hours spent.
      entry({ mediaType: 'tv', status: 'watched', runtime: 45 }),
    ]);
    expect(s.watchTimeMinutes).toBe(90);
    expect(s.watchTimeCoverage).toBe(1);
  });

  it('reports zero, with zero coverage, when no runtime is known', () => {
    const s = computeStats([entry({ status: 'watched' }), entry({ status: 'watched' })]);
    expect(s.watchTimeMinutes).toBe(0);
    expect(s.watchTimeCoverage).toBe(0);
  });

  it('ranks decades by count, busiest first', () => {
    const s = computeStats([
      entry({ year: '1995' }),
      entry({ year: '1999' }),
      entry({ year: '2021' }),
      entry({ year: '' }), // ignored
      entry({ year: 'n/a' }), // ignored
    ]);
    expect(s.topDecades).toEqual([
      { decade: 1990, count: 2 },
      { decade: 2020, count: 1 },
    ]);
  });
});

describe('formatWatchTime', () => {
  // A stand-in catalogue: the function's job is picking the right shape, not
  // translating it.
  const t = (key: string, vars?: Record<string, string | number>) =>
    key === 'stats.minutes'
      ? `${vars?.m} min`
      : key === 'stats.hours'
        ? `${vars?.h} h`
        : `${vars?.h} h ${vars?.m}`;

  it('drops the hour part under an hour', () => {
    expect(formatWatchTime(47, t)).toBe('47 min');
    expect(formatWatchTime(0, t)).toBe('0 min');
  });

  it('drops the minute part on a round hour', () => {
    expect(formatWatchTime(120, t)).toBe('2 h');
  });

  it('shows both parts otherwise, rounding to the minute', () => {
    expect(formatWatchTime(139, t)).toBe('2 h 19');
    expect(formatWatchTime(139.6, t)).toBe('2 h 20');
  });

  it('never reports negative time', () => {
    expect(formatWatchTime(-30, t)).toBe('0 min');
  });
});
