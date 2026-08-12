/**
 * Library insights: turn a raw watchlist into a few honest numbers about your
 * own taste: how much you've watched vs. parked, your movies/shows split, how
 * generous your ratings are, and which decades you gravitate towards.
 *
 * Everything is derived purely from the entries the app already stores (no
 * extra TMDB calls, no account needed), so it works offline and is trivial to
 * unit-test. The React panel is a thin renderer over `computeStats`.
 */
import type { LibraryEntry } from './types';

export interface DecadeCount {
  decade: number; // e.g. 1990 for the 1990s
  count: number;
}

export interface LibraryStats {
  total: number;
  want: number;
  watching: number;
  watched: number;
  movies: number;
  tv: number;
  /** watched / total, 0..1: your "completion" of what you've saved. */
  completionRate: number;
  /** How many entries carry a personal rating. */
  ratedCount: number;
  /** Mean personal rating over rated entries (1 decimal), or null if none. */
  avgPersonalRating: number | null;
  /** Mean TMDB rating over entries that have one (1 decimal), or null. */
  avgTmdbRating: number | null;
  /**
   * Mean of (personal − TMDB) over entries carrying both ratings (1 decimal):
   * positive means you rate more generously than the crowd. Null when no
   * entry has both.
   */
  personalVsTmdb: number | null;
  /** Counts per personal rating 1..10; index 0 = rating 1, index 9 = rating 10. */
  ratingDistribution: number[];
  /** Decades present in the collection, busiest first. */
  topDecades: DecadeCount[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function decadeOf(year: string): number | null {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1870 || y > 2100) return null;
  return Math.floor(y / 10) * 10;
}

export function computeStats(entries: LibraryEntry[]): LibraryStats {
  const total = entries.length;
  let watching = 0;
  let watched = 0;
  let movies = 0;
  let tv = 0;

  const personal: number[] = [];
  const tmdb: number[] = [];
  const deltas: number[] = [];
  const ratingDistribution = new Array(10).fill(0) as number[];
  const decades = new Map<number, number>();

  for (const e of entries) {
    if (e.status === 'watched') watched += 1;
    else if (e.status === 'watching') watching += 1;
    if (e.mediaType === 'tv') tv += 1;
    else movies += 1;

    if (typeof e.personalRating === 'number' && e.personalRating >= 1 && e.personalRating <= 10) {
      personal.push(e.personalRating);
      ratingDistribution[Math.round(e.personalRating) - 1] += 1;
    }
    if (typeof e.rating === 'number' && e.rating > 0) {
      tmdb.push(e.rating);
      if (typeof e.personalRating === 'number' && e.personalRating >= 1 && e.personalRating <= 10) {
        deltas.push(e.personalRating - e.rating);
      }
    }

    const d = decadeOf(e.year);
    if (d !== null) decades.set(d, (decades.get(d) || 0) + 1);
  }

  const mean = (xs: number[]) =>
    xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

  const topDecades = [...decades.entries()]
    .map(([decade, count]) => ({ decade, count }))
    // Busiest first; ties broken by most recent decade so the list is stable.
    .sort((a, b) => b.count - a.count || b.decade - a.decade);

  return {
    total,
    want: total - watched - watching,
    watching,
    watched,
    movies,
    tv,
    completionRate: total ? round1(watched / total) : 0,
    ratedCount: personal.length,
    avgPersonalRating: mean(personal),
    avgTmdbRating: mean(tmdb),
    personalVsTmdb: mean(deltas),
    ratingDistribution,
    topDecades,
  };
}
