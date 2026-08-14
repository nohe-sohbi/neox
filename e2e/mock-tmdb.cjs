/**
 * Mock TMDB v3 API for end-to-end testing NEOX without a real API key.
 * Serves deterministic fixtures for every endpoint the backend consumes.
 * Usage: node mock-tmdb.js [port]   (default 3999)
 */
const http = require('http');

const PORT = Number(process.argv[2]) || 3999;

const GENRES_MOVIE = [
  { id: 28, name: 'Action' },
  { id: 18, name: 'Drame' },
  { id: 878, name: 'Science-Fiction' },
  { id: 35, name: 'Comédie' },
];
const GENRES_TV = [
  { id: 18, name: 'Drame' },
  { id: 10765, name: 'Science-Fiction & Fantastique' },
];

function movie(id, title, opts = {}) {
  return {
    id,
    title,
    original_title: opts.original || title,
    overview: opts.overview || `Synopsis de ${title}. Un film remarquable qui a marqué son époque.`,
    poster_path: `/poster-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    release_date: opts.date || '2024-03-15',
    vote_average: opts.rating ?? 7.8,
    vote_count: opts.votes ?? 3200,
    popularity: opts.popularity ?? 500,
    genre_ids: opts.genres || [28, 878],
    ...(opts.extra || {}),
  };
}

function show(id, name, opts = {}) {
  return {
    id,
    name,
    original_name: opts.original || name,
    overview: opts.overview || `Synopsis de ${name}. Une série saluée par la critique.`,
    poster_path: `/poster-tv-${id}.jpg`,
    backdrop_path: `/backdrop-tv-${id}.jpg`,
    first_air_date: opts.date || '2023-09-01',
    vote_average: opts.rating ?? 8.2,
    vote_count: opts.votes ?? 2100,
    popularity: opts.popularity ?? 420,
    genre_ids: opts.genres || [18],
    ...(opts.extra || {}),
  };
}

const MOVIES = [
  movie(550, 'Fight Club', { date: '1999-10-15', rating: 8.4, votes: 27000, popularity: 900 }),
  movie(680, 'Pulp Fiction', { date: '1994-10-14', rating: 8.5, votes: 25000, popularity: 850 }),
  movie(27205, 'Inception', { date: '2010-07-16', rating: 8.4, votes: 34000, popularity: 800 }),
  movie(157336, 'Interstellar', { date: '2014-11-05', rating: 8.4, votes: 32000, popularity: 780 }),
  movie(603, 'Matrix', { date: '1999-03-31', rating: 8.2, votes: 24000, popularity: 760 }),
  movie(155, 'The Dark Knight', { date: '2008-07-18', rating: 8.5, votes: 30000, popularity: 740 }),
  movie(122, 'Le Seigneur des anneaux', { date: '2003-12-17', rating: 8.5, votes: 22000, popularity: 720 }),
  movie(496243, 'Parasite', { date: '2019-05-30', rating: 8.5, votes: 17000, popularity: 700 }),
];

const SHOWS = [
  show(1396, 'Breaking Bad', { date: '2008-01-20', rating: 8.9, votes: 12000, popularity: 650 }),
  show(94605, 'Arcane', { date: '2021-11-06', rating: 8.7, votes: 4000, popularity: 620 }),
  show(66732, 'Stranger Things', { date: '2016-07-15', rating: 8.6, votes: 16000, popularity: 600 }),
  show(1399, 'Game of Thrones', { date: '2011-04-17', rating: 8.4, votes: 23000, popularity: 580 }),
];

const PEOPLE = [
  { id: 287, name: 'Brad Pitt', profile_path: '/brad.jpg', known_for_department: 'Acting', popularity: 80 },
  { id: 6193, name: 'Leonardo DiCaprio', profile_path: '/leo.jpg', known_for_department: 'Acting', popularity: 90 },
];

// A large fixture family so search pagination has something to paginate:
// searching "galaxie" yields 33 movies → 2 pages of 20.
const GALAXIE = Array.from({ length: 33 }, (_, i) =>
  movie(9000 + i, `Galaxie ${i + 1}`, { date: `19${60 + (i % 40)}-01-01`, popularity: 100 - i }),
);

function paged(results) {
  return { page: 1, total_pages: 1, total_results: results.length, results };
}

function pagedAt(all, page, size = 20) {
  return {
    page,
    total_pages: Math.max(1, Math.ceil(all.length / size)),
    total_results: all.length,
    results: all.slice((page - 1) * size, page * size),
  };
}

function withMediaType(items, type) {
  return items.map((i) => ({ ...i, media_type: type }));
}

const CAST = [
  { id: 287, name: 'Brad Pitt', character: 'Tyler Durden', profile_path: '/brad.jpg' },
  { id: 819, name: 'Edward Norton', character: 'Le narrateur', profile_path: '/ed.jpg' },
];

// Crew: a director, a writer credited twice (dedup), and a job nobody asks about.
const CREW = [
  { id: 7467, name: 'David Fincher', job: 'Director', profile_path: '/fincher.jpg' },
  { id: 7468, name: 'Jim Uhls', job: 'Screenplay', profile_path: '/uhls.jpg' },
  { id: 7468, name: 'Jim Uhls', job: 'Story', profile_path: '/uhls.jpg' },
  { id: 9999, name: 'Perchman', job: 'Sound', profile_path: null },
];

// Only Matrix belongs to a saga, so the fiche can be tested both ways.
const COLLECTION_ID = 2344;
const COLLECTION_MOVIES = [
  movie(604, 'Matrix Reloaded', { date: '2003-05-15', rating: 7.0 }),
  movie(605, 'Matrix Revolutions', { date: '2003-11-05', rating: 6.7 }),
];

function movieDetails(id) {
  const base = MOVIES.find((m) => m.id === id) || movie(id, `Film ${id}`);
  return {
    ...base,
    tagline: 'Une expérience inoubliable.',
    runtime: 139,
    status: 'Released',
    genres: GENRES_MOVIE.filter((g) => (base.genre_ids || []).includes(g.id)),
    belongs_to_collection:
      id === 603 ? { id: COLLECTION_ID, name: 'Matrix', poster_path: '/saga.jpg' } : null,
    release_dates: {
      results: [
        { iso_3166_1: 'US', release_dates: [{ certification: 'R' }] },
        { iso_3166_1: 'FR', release_dates: [{ certification: '' }, { certification: '12' }] },
      ],
    },
    videos: { results: [{ site: 'YouTube', type: 'Trailer', official: true, key: 'dQw4w9WgXcQ' }] },
    credits: { cast: CAST, crew: CREW },
    recommendations: paged(MOVIES.filter((m) => m.id !== id).slice(0, 6)),
    'watch/providers': {
      results: {
        FR: {
          link: 'https://www.themoviedb.org/movie/' + id + '/watch',
          flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
          rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg' }],
          buy: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg' }],
        },
      },
    },
  };
}

function tvDetails(id) {
  const base = SHOWS.find((s) => s.id === id) || show(id, `Série ${id}`);
  return {
    ...base,
    tagline: 'Une série événement.',
    episode_run_time: [47],
    status: 'Ended',
    number_of_seasons: 2,
    number_of_episodes: 16,
    genres: GENRES_TV.filter((g) => (base.genre_ids || []).includes(g.id)),
    seasons: [
      { season_number: 1, name: 'Saison 1', overview: '', poster_path: '/s1.jpg', episode_count: 8, air_date: '2023-09-01' },
      { season_number: 2, name: 'Saison 2', overview: '', poster_path: '/s2.jpg', episode_count: 8, air_date: '2024-09-01' },
    ],
    created_by: [{ id: 66633, name: 'Vince Gilligan', profile_path: '/vg.jpg' }],
    content_ratings: {
      results: [
        { iso_3166_1: 'US', rating: 'TV-MA' },
        { iso_3166_1: 'FR', rating: '16' },
      ],
    },
    videos: { results: [{ site: 'YouTube', type: 'Trailer', official: true, key: 'abc123def45' }] },
    credits: { cast: CAST, crew: [] },
    recommendations: paged(SHOWS.filter((s) => s.id !== id).slice(0, 6)),
    'watch/providers': {
      results: {
        FR: {
          link: 'https://www.themoviedb.org/tv/' + id + '/watch',
          flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
          rent: [],
          buy: [],
        },
      },
    },
  };
}

function season(tvId, n) {
  return {
    season_number: n,
    name: `Saison ${n}`,
    overview: `La saison ${n}.`,
    poster_path: `/s${n}.jpg`,
    air_date: `202${2 + n}-09-01`,
    episodes: Array.from({ length: 8 }, (_, i) => ({
      episode_number: i + 1,
      name: `Épisode ${i + 1}`,
      overview: `Résumé de l'épisode ${i + 1}.`,
      still_path: `/still-${n}-${i + 1}.jpg`,
      air_date: `202${2 + n}-09-0${Math.min(i + 1, 9)}`,
      runtime: 47,
      vote_average: 8.1,
      vote_count: 300,
    })),
  };
}

function person(id) {
  const p = PEOPLE.find((x) => x.id === id) || PEOPLE[0];
  return {
    ...p,
    biography: `${p.name} est une personnalité majeure du cinéma.`,
    birthday: '1963-12-18',
    place_of_birth: 'Shawnee, Oklahoma, USA',
    combined_credits: {
      cast: MOVIES.slice(0, 5).map((m) => ({ ...m, media_type: 'movie', character: 'Rôle principal' })),
    },
  };
}

let requestLog = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  requestLog.push(p);
  res.setHeader('content-type', 'application/json');

  const send = (obj, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(obj));
  };

  // Trending
  let m;
  if ((m = p.match(/^\/3\/trending\/(all|movie|tv)\/(day|week)$/))) {
    let items;
    if (m[1] === 'movie') items = withMediaType(MOVIES, 'movie');
    else if (m[1] === 'tv') items = withMediaType(SHOWS, 'tv');
    else items = [...withMediaType(MOVIES.slice(0, 5), 'movie'), ...withMediaType(SHOWS.slice(0, 3), 'tv')];
    // Day window is reversed so E2E can observe the toggle taking effect.
    if (m[2] === 'day') items = [...items].reverse();
    return send(paged(items));
  }
  if ((m = p.match(/^\/3\/movie\/(now_playing|popular|top_rated|upcoming)$/))) {
    return send(paged(MOVIES));
  }
  if (p === '/3/tv/popular' || p === '/3/tv/top_rated') return send(paged(SHOWS));
  if ((m = p.match(/^\/3\/genre\/(movie|tv)\/list$/))) {
    return send({ genres: m[1] === 'movie' ? GENRES_MOVIE : GENRES_TV });
  }
  if ((m = p.match(/^\/3\/discover\/(movie|tv)$/))) {
    let items = m[1] === 'movie' ? [...MOVIES] : [...SHOWS];
    const year = url.searchParams.get('primary_release_year') || url.searchParams.get('first_air_date_year');
    if (year) items = items.filter((i) => (i.release_date || i.first_air_date || '').startsWith(year));
    const minR = Number(url.searchParams.get('vote_average.gte'));
    if (minR) items = items.filter((i) => i.vote_average >= minR);
    const genre = url.searchParams.get('with_genres');
    if (genre) items = items.filter((i) => (i.genre_ids || []).includes(Number(genre)));
    return send(paged(items));
  }
  if ((m = p.match(/^\/3\/collection\/(\d+)$/))) {
    return send({
      id: Number(m[1]),
      name: 'Saga Matrix',
      poster_path: '/saga.jpg',
      // Includes the film itself: the backend is the one that removes it.
      parts: [...COLLECTION_MOVIES, MOVIES.find((x) => x.id === 603)],
    });
  }
  // Typed search: the narrowed modes hit one endpoint per media type.
  if ((m = p.match(/^\/3\/search\/(movie|tv)$/))) {
    const q = (url.searchParams.get('query') || '').toLowerCase();
    const page = Number(url.searchParams.get('page')) || 1;
    const all =
      m[1] === 'movie'
        ? [...MOVIES, ...GALAXIE].filter((x) => x.title.toLowerCase().includes(q))
        : SHOWS.filter((x) => x.name.toLowerCase().includes(q));
    return send(pagedAt(all, page));
  }
  if (p === '/3/search/multi') {
    const q = (url.searchParams.get('query') || '').toLowerCase();
    const page = Number(url.searchParams.get('page')) || 1;
    const all = [
      ...withMediaType([...MOVIES, ...GALAXIE].filter((x) => x.title.toLowerCase().includes(q)), 'movie'),
      ...withMediaType(SHOWS.filter((x) => x.name.toLowerCase().includes(q)), 'tv'),
      ...PEOPLE.filter((x) => x.name.toLowerCase().includes(q)).map((x) => ({ ...x, media_type: 'person' })),
    ];
    return send(pagedAt(all, page));
  }
  if ((m = p.match(/^\/3\/watch\/providers\/(movie|tv)$/))) {
    return send({
      results: [
        { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 },
        { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg', display_priority: 2 },
        { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/prime.jpg', display_priority: 3 },
      ],
    });
  }
  if ((m = p.match(/^\/3\/movie\/(\d+)\/recommendations$/))) {
    return send(paged(withMediaType(MOVIES.filter((x) => x.id !== Number(m[1])).slice(0, 6), 'movie')));
  }
  if ((m = p.match(/^\/3\/tv\/(\d+)\/recommendations$/))) {
    return send(paged(withMediaType(SHOWS.filter((x) => x.id !== Number(m[1])).slice(0, 6), 'tv')));
  }
  if ((m = p.match(/^\/3\/tv\/(\d+)\/season\/(\d+)$/))) {
    return send(season(Number(m[1]), Number(m[2])));
  }
  if ((m = p.match(/^\/3\/movie\/(\d+)$/))) return send(movieDetails(Number(m[1])));
  if ((m = p.match(/^\/3\/tv\/(\d+)$/))) return send(tvDetails(Number(m[1])));
  if ((m = p.match(/^\/3\/person\/(\d+)$/))) return send(person(Number(m[1])));
  if (p === '/__log') return send(requestLog);

  send({ success: false, status_code: 34, status_message: `Mock: no route for ${p}` }, 404);
});

server.listen(PORT, () => console.log(`Mock TMDB listening on http://localhost:${PORT}/3`));
