import type { SeasonSummary } from './types';

/**
 * Orders a show's seasons for display: regular seasons ascending (1, 2, 3…)
 * with "Specials" (season 0) pushed to the end, where viewers expect it. The
 * input is never mutated.
 */
export function orderedSeasons(seasons: SeasonSummary[]): SeasonSummary[] {
  return [...seasons].sort((a, b) => {
    const aSpecial = a.seasonNumber === 0;
    const bSpecial = b.seasonNumber === 0;
    if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
    return a.seasonNumber - b.seasonNumber;
  });
}

/** Compact episode code, e.g. S1 E3. */
export function formatEpisodeCode(seasonNumber: number, episodeNumber: number): string {
  return `S${seasonNumber} E${episodeNumber}`;
}

export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/**
 * The episode to watch next: the first one, in broadcast order, that isn't
 * ticked off yet. Specials (season 0) are skipped — they are not part of the
 * through-line, and "next up: a 2011 Christmas special" is not what someone
 * two episodes into season 3 is asking for.
 *
 * Returns null when the show is fully watched (or has no listed episodes),
 * which is what tells the caller there is nothing to resume.
 */
export function nextUnseenEpisode(
  seasons: SeasonSummary[],
  seenEpisodes: string[] = [],
): EpisodeRef | null {
  const seen = new Set(seenEpisodes);
  for (const season of orderedSeasons(seasons)) {
    if (season.seasonNumber === 0) continue;
    for (let episode = 1; episode <= season.episodeCount; episode++) {
      if (!seen.has(`${season.seasonNumber}:${episode}`)) {
        return { seasonNumber: season.seasonNumber, episodeNumber: episode };
      }
    }
  }
  return null;
}

/** How many of a show's listed episodes are ticked, and how many there are. */
export function seriesProgress(
  seasons: SeasonSummary[],
  seenEpisodes: string[] = [],
): { seen: number; total: number } {
  const seen = new Set(seenEpisodes);
  let total = 0;
  let watched = 0;
  for (const season of seasons) {
    total += season.episodeCount;
    for (let episode = 1; episode <= season.episodeCount; episode++) {
      if (seen.has(`${season.seasonNumber}:${episode}`)) watched += 1;
    }
  }
  return { seen: watched, total };
}
