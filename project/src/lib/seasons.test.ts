import { describe, expect, it } from 'vitest';
import { formatEpisodeCode, orderedSeasons } from './seasons';
import type { SeasonSummary } from './types';

const season = (seasonNumber: number, name = `Season ${seasonNumber}`): SeasonSummary => ({
  seasonNumber,
  name,
  overview: '',
  poster: null,
  episodeCount: 8,
  airYear: '2020',
});

describe('orderedSeasons', () => {
  it('sorts regular seasons ascending', () => {
    const out = orderedSeasons([season(3), season(1), season(2)]);
    expect(out.map((s) => s.seasonNumber)).toEqual([1, 2, 3]);
  });

  it('pushes specials (season 0) to the end', () => {
    const out = orderedSeasons([season(0, 'Specials'), season(2), season(1)]);
    expect(out.map((s) => s.seasonNumber)).toEqual([1, 2, 0]);
  });

  it('does not mutate the input array', () => {
    const input = [season(2), season(1)];
    orderedSeasons(input);
    expect(input.map((s) => s.seasonNumber)).toEqual([2, 1]);
  });

  it('handles an empty list', () => {
    expect(orderedSeasons([])).toEqual([]);
  });
});

describe('formatEpisodeCode', () => {
  it('formats season and episode into a compact code', () => {
    expect(formatEpisodeCode(1, 3)).toBe('S1 E3');
    expect(formatEpisodeCode(0, 1)).toBe('S0 E1');
  });
});
