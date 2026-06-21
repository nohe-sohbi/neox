import { describe, expect, it } from 'vitest';

const tmdb = require('./tmdb');
const { buildDiscoverParams } = tmdb;

describe('buildDiscoverParams', () => {
  it('defaults to popularity sort and a sane vote floor', () => {
    const p = buildDiscoverParams('movie');
    expect(p.sort_by).toBe('popularity.desc');
    expect(p['vote_count.gte']).toBe('50');
    expect(p.page).toBe('1');
  });

  it('maps year to the right TMDB key per media type', () => {
    expect(buildDiscoverParams('movie', { year: 1999 }).primary_release_year).toBe('1999');
    expect(buildDiscoverParams('movie', { year: 1999 }).first_air_date_year).toBeUndefined();

    expect(buildDiscoverParams('tv', { year: 2008 }).first_air_date_year).toBe('2008');
    expect(buildDiscoverParams('tv', { year: 2008 }).primary_release_year).toBeUndefined();
  });

  it('ignores out-of-range or non-numeric years', () => {
    expect(buildDiscoverParams('movie', { year: 1700 }).primary_release_year).toBeUndefined();
    expect(buildDiscoverParams('movie', { year: 'abc' }).primary_release_year).toBeUndefined();
  });

  it('applies a minimum rating and tightens the vote floor', () => {
    const p = buildDiscoverParams('movie', { minRating: 7.5 });
    expect(p['vote_average.gte']).toBe('7.5');
    // A rating filter without a meaningful vote count is noise, so the floor rises.
    expect(p['vote_count.gte']).toBe('200');
  });

  it('ignores invalid ratings', () => {
    expect(buildDiscoverParams('movie', { minRating: 0 })['vote_average.gte']).toBeUndefined();
    expect(buildDiscoverParams('movie', { minRating: 99 })['vote_average.gte']).toBeUndefined();
    expect(buildDiscoverParams('movie', { minRating: 0 })['vote_count.gte']).toBe('50');
  });

  it('passes genre and provider filters through', () => {
    const p = buildDiscoverParams('movie', {
      genre: 28,
      providers: ['8', '337'],
      region: 'fr',
    });
    expect(p.with_genres).toBe('28');
    expect(p.with_watch_providers).toBe('8|337');
    expect(p.watch_region).toBe('FR');
    expect(p.with_watch_monetization_types).toBe('flatrate');
  });

  it('combines every filter at once', () => {
    const p = buildDiscoverParams('tv', {
      genre: 18,
      sort: 'vote_average.desc',
      year: 2015,
      minRating: 8,
      page: 3,
    });
    expect(p).toMatchObject({
      with_genres: '18',
      sort_by: 'vote_average.desc',
      first_air_date_year: '2015',
      'vote_average.gte': '8',
      page: '3',
    });
  });
});
