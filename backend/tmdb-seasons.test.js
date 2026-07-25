import { describe, expect, it } from 'vitest';

const { normalizeSeasons, normalizeSeason } = require('./tmdb');

describe('normalizeSeasons (TV details season index)', () => {
  it('keeps only seasons with episodes and sorts by season number', () => {
    const out = normalizeSeasons([
      { season_number: 2, name: 'Season 2', episode_count: 8, air_date: '2021-06-01' },
      { season_number: 1, name: 'Season 1', episode_count: 10, air_date: '2020-01-15' },
      // Upcoming/empty season TMDB sometimes lists: dropped.
      { season_number: 3, name: 'Season 3', episode_count: 0, air_date: null },
    ]);
    expect(out.map((s) => s.seasonNumber)).toEqual([1, 2]);
    expect(out[0]).toMatchObject({ seasonNumber: 1, episodeCount: 10, airYear: '2020' });
  });

  it('preserves specials (season 0) when they have episodes', () => {
    const out = normalizeSeasons([
      { season_number: 0, name: 'Specials', episode_count: 3, air_date: '2019-12-01' },
      { season_number: 1, name: 'Season 1', episode_count: 6, air_date: '2020-01-01' },
    ]);
    expect(out.map((s) => s.seasonNumber)).toEqual([0, 1]);
  });

  it('builds absolute poster URLs and tolerates missing fields', () => {
    const out = normalizeSeasons([
      { season_number: 1, episode_count: 4, poster_path: '/abc.jpg' },
    ]);
    expect(out[0].poster).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
    expect(out[0].name).toBe('');
    expect(out[0].overview).toBe('');
    expect(out[0].airYear).toBe('');
  });

  it('returns an empty array for missing/invalid input', () => {
    expect(normalizeSeasons(undefined)).toEqual([]);
    expect(normalizeSeasons(null)).toEqual([]);
    expect(normalizeSeasons([null, {}])).toEqual([]);
  });
});

describe('normalizeSeason (full episode list)', () => {
  it('normalizes episodes into the compact client shape', () => {
    const out = normalizeSeason(
      {
        season_number: 1,
        name: 'Season 1',
        overview: 'The beginning.',
        poster_path: '/s1.jpg',
        air_date: '2020-01-15',
        episodes: [
          {
            episode_number: 1,
            name: 'Pilot',
            overview: 'It starts.',
            still_path: '/still1.jpg',
            air_date: '2020-01-15',
            runtime: 48,
            vote_average: 8.234,
            vote_count: 120,
          },
        ],
      },
      1,
    );
    expect(out).toMatchObject({
      seasonNumber: 1,
      name: 'Season 1',
      poster: 'https://image.tmdb.org/t/p/w500/s1.jpg',
      airDate: '2020-01-15',
    });
    expect(out.episodes).toHaveLength(1);
    expect(out.episodes[0]).toEqual({
      episodeNumber: 1,
      name: 'Pilot',
      overview: 'It starts.',
      still: 'https://image.tmdb.org/t/p/w300/still1.jpg',
      airDate: '2020-01-15',
      runtime: 48,
      rating: 8.2,
      voteCount: 120,
    });
  });

  it('maps an unrated episode (vote_average 0) to a null rating', () => {
    const out = normalizeSeason(
      { season_number: 1, episodes: [{ episode_number: 1, vote_average: 0 }] },
      1,
    );
    expect(out.episodes[0].rating).toBeNull();
    expect(out.episodes[0].still).toBeNull();
  });

  it('falls back to the requested season number and tolerates no episodes', () => {
    const out = normalizeSeason({ name: 'Mystery' }, 4);
    expect(out.seasonNumber).toBe(4);
    expect(out.episodes).toEqual([]);
  });
});
