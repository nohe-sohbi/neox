import { describe, expect, it } from 'vitest';
import {
  buildMediaSchema,
  buildPersonSchema,
  buildWebSite,
  isoDuration,
} from './structured-data';
import type { MediaDetails, Person } from './types';

const movie: MediaDetails = {
  id: 157336,
  mediaType: 'movie',
  title: 'Interstellar',
  originalTitle: 'Interstellar',
  overview: 'Dans un futur proche, un groupe d’explorateurs franchit un trou de ver.',
  poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
  year: '2014',
  rating: 8.456,
  voteCount: 40420,
  popularity: 120,
  tagline: 'L’Homme est né sur Terre.',
  runtime: 169,
  status: 'Released',
  genres: ['Aventure', 'Drame'],
  releaseDate: '2014-11-05',
  numberOfSeasons: null,
  numberOfEpisodes: null,
  seasons: [],
  trailerKey: 'zSWdZVtXT7E',
  cast: [
    { id: 1, name: 'Matthew McConaughey', character: 'Cooper', photo: null },
    { id: 2, name: 'Anne Hathaway', character: 'Brand', photo: null },
  ],
  providers: { link: null, flatrate: [], rent: [], buy: [] },
  recommendations: [],
};

const URL_MOVIE = 'https://neox.example/?watch=movie-157336';

describe('isoDuration', () => {
  it('formats hours and minutes', () => {
    expect(isoDuration(169)).toBe('PT2H49M');
  });

  it('omits the empty component', () => {
    expect(isoDuration(120)).toBe('PT2H');
    expect(isoDuration(45)).toBe('PT45M');
  });

  it('returns null for a missing or nonsense runtime', () => {
    expect(isoDuration(null)).toBeNull();
    expect(isoDuration(0)).toBeNull();
    expect(isoDuration(-10)).toBeNull();
  });
});

describe('buildWebSite', () => {
  it('declares a SearchAction with the required query-input', () => {
    const ld = buildWebSite();
    expect(ld['@type']).toBe('WebSite');
    const action = ld.potentialAction as Record<string, unknown>;
    expect(action['@type']).toBe('SearchAction');
    expect(action['query-input']).toBe('required name=search_term_string');
    expect(String((action.target as Record<string, unknown>).urlTemplate)).toContain(
      '{search_term_string}',
    );
  });
});

describe('buildMediaSchema', () => {
  it('types a film as Movie and carries its identity', () => {
    const ld = buildMediaSchema(movie, URL_MOVIE);
    expect(ld['@type']).toBe('Movie');
    expect(ld.name).toBe('Interstellar');
    expect(ld.url).toBe(URL_MOVIE);
    expect(ld.datePublished).toBe('2014-11-05');
    expect(ld.duration).toBe('PT2H49M');
    expect(ld.genre).toEqual(['Aventure', 'Drame']);
  });

  it('rounds the rating and keeps the real vote count', () => {
    const rating = buildMediaSchema(movie, URL_MOVIE).aggregateRating as Record<string, unknown>;
    expect(rating.ratingValue).toBe(8.5);
    expect(rating.ratingCount).toBe(40420);
    expect(rating.bestRating).toBe(10);
  });

  it('omits aggregateRating entirely when no vote backs it', () => {
    // Google rejects a rating without a count, so a rating with voteCount 0
    // must not be emitted rather than emitted with a fabricated count.
    const ld = buildMediaSchema({ ...movie, voteCount: 0 }, URL_MOVIE);
    expect(ld.aggregateRating).toBeUndefined();
  });

  it('omits alternateName when the original title is the same', () => {
    expect(buildMediaSchema(movie, URL_MOVIE).alternateName).toBeUndefined();
  });

  it('keeps alternateName when the original title differs', () => {
    const ld = buildMediaSchema({ ...movie, originalTitle: 'Interstellar (original)' }, URL_MOVIE);
    expect(ld.alternateName).toBe('Interstellar (original)');
  });

  it('types a series as TVSeries with its season counts and no duration', () => {
    const ld = buildMediaSchema(
      {
        ...movie,
        mediaType: 'tv',
        title: 'Severance',
        originalTitle: 'Severance',
        numberOfSeasons: 2,
        numberOfEpisodes: 19,
      },
      'https://neox.example/?watch=tv-95396',
    );
    expect(ld['@type']).toBe('TVSeries');
    expect(ld.numberOfSeasons).toBe(2);
    expect(ld.numberOfEpisodes).toBe(19);
    expect(ld.duration).toBeUndefined();
  });

  it('caps the cast and exposes it as Person entries', () => {
    const cast = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `Actor ${i}`,
      character: 'x',
      photo: null,
    }));
    const actors = buildMediaSchema({ ...movie, cast }, URL_MOVIE).actor as Record<
      string,
      unknown
    >[];
    expect(actors).toHaveLength(8);
    expect(actors[0]['@type']).toBe('Person');
  });

  it('omits the trailer when there is no key', () => {
    expect(buildMediaSchema({ ...movie, trailerKey: null }, URL_MOVIE).trailer).toBeUndefined();
  });
});

describe('buildPersonSchema', () => {
  const person: Person = {
    id: 1,
    name: 'Anne Hathaway',
    biography: 'Actrice américaine.',
    photo: 'https://image.tmdb.org/t/p/w300/photo.jpg',
    knownFor: 'Acting',
    birthday: '1982-11-12',
    placeOfBirth: 'New York City',
    credits: [],
  };

  it('carries name, dates and birth place', () => {
    const ld = buildPersonSchema(person, 'https://neox.example/?person=1');
    expect(ld['@type']).toBe('Person');
    expect(ld.birthDate).toBe('1982-11-12');
    expect((ld.birthPlace as Record<string, unknown>).name).toBe('New York City');
  });

  it('omits the empty fields instead of emitting them blank', () => {
    const ld = buildPersonSchema(
      { ...person, biography: '', photo: null, birthday: null, placeOfBirth: '' },
      'https://neox.example/?person=1',
    );
    expect(ld.description).toBeUndefined();
    expect(ld.image).toBeUndefined();
    expect(ld.birthDate).toBeUndefined();
    expect(ld.birthPlace).toBeUndefined();
  });
});
