import { describe, expect, it } from 'vitest';
import {
  formatEpisodeCode,
  nextUnseenEpisode,
  orderedSeasons,
  seriesProgress,
} from './seasons';
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

describe('nextUnseenEpisode', () => {
  const show = [season(1), season(2)]; // 8 episodes each

  it('starts at the pilot when nothing is ticked', () => {
    expect(nextUnseenEpisode(show, [])).toEqual({ seasonNumber: 1, episodeNumber: 1 });
  });

  it('returns the first gap, not the one after the highest tick', () => {
    // S1E1 and S1E3 seen: what is next to watch is E2, which was skipped.
    expect(nextUnseenEpisode(show, ['1:1', '1:3'])).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it('rolls over to the next season once one is complete', () => {
    const wholeFirst = Array.from({ length: 8 }, (_, i) => `1:${i + 1}`);
    expect(nextUnseenEpisode(show, wholeFirst)).toEqual({ seasonNumber: 2, episodeNumber: 1 });
  });

  it('returns null when the whole show is watched', () => {
    const everything = [1, 2].flatMap((s) => Array.from({ length: 8 }, (_, i) => `${s}:${i + 1}`));
    expect(nextUnseenEpisode(show, everything)).toBeNull();
  });

  it('never proposes a special as the next episode', () => {
    const withSpecials = [season(0, 'Specials'), season(1)];
    expect(nextUnseenEpisode(withSpecials, [])).toEqual({ seasonNumber: 1, episodeNumber: 1 });
  });

  it('is null for a show with no listed seasons', () => {
    expect(nextUnseenEpisode([], ['1:1'])).toBeNull();
  });
});

describe('seriesProgress', () => {
  it('counts ticks across every season, specials included', () => {
    expect(seriesProgress([season(0, 'Specials'), season(1), season(2)], ['1:1', '2:8', '0:1']))
      .toEqual({ seen: 3, total: 24 });
  });

  it('ignores ticks pointing outside the listed episodes', () => {
    // A season trimmed upstream must not inflate the count with stale codes.
    expect(seriesProgress([season(1)], ['1:1', '1:99', '5:1'])).toEqual({ seen: 1, total: 8 });
  });

  it('is zero-over-zero for a show with no seasons', () => {
    expect(seriesProgress([], [])).toEqual({ seen: 0, total: 0 });
  });
});
