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
