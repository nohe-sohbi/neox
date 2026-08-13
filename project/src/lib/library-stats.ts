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
  /**
   * Minutes spent watching, over the entries whose length the app knows:
   * a watched film counts its runtime, a show counts one episode length per
   * ticked episode. Runtimes are captured when a fiche is opened, so this is
   * a floor, never an inflated guess — `watchTimeCoverage` says how many
   * entries it rests on.
   */
  watchTimeMinutes: number;
  /** How many entries contributed to `watchTimeMinutes`. */
  watchTimeCoverage: number;
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
  let watchTimeMinutes = 0;
  let watchTimeCoverage = 0;

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

    // Time actually spent in front of the thing: a film only counts once it
    // is watched, a show counts the episodes ticked off — a series marked
    // "watched" with no episode ticked says nothing about how long it ran.
    if (typeof e.runtime === 'number' && e.runtime > 0) {
      if (e.mediaType === 'tv') {
        const episodes = e.seenEpisodes?.length ?? 0;
        if (episodes > 0) {
          watchTimeMinutes += episodes * e.runtime;
          watchTimeCoverage += 1;
        }
      } else if (e.status === 'watched') {
        watchTimeMinutes += e.runtime;
        watchTimeCoverage += 1;
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
    watchTimeMinutes,
    watchTimeCoverage,
  };
}

/** Minutes → "12 h 40" / "40 min", for a tile that has one line to say it in. */
export function formatWatchTime(minutes: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t('stats.minutes', { m });
  if (m === 0) return t('stats.hours', { h });
  return t('stats.hours_minutes', { h, m });
}
