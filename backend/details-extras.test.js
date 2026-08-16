/**
 * The fiche's newer payload — crew, regional certification, saga — and the
 * typed search, tested end to end through the API against a local TMDB
 * fixture (injected via TMDB_BASE_URL). Every assertion here is about what a
 * client actually receives, plus what the server actually asked upstream.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-details-'));

let upstream;
let app;
const hits = [];

const MOVIE = {
    id: 671,
    title: 'Harry Potter à l’école des sorciers',
    overview: 'Un sorcier découvre Poudlard.',
    poster_path: '/hp1.jpg',
    backdrop_path: '/hp1-bd.jpg',
    release_date: '2001-11-16',
    vote_average: 7.9,
    vote_count: 26000,
    genres: [{ id: 12, name: 'Aventure' }],
    belongs_to_collection: { id: 1241, name: 'Harry Potter', poster_path: '/saga.jpg' },
    credits: {
        cast: [{ id: 10980, name: 'Daniel Radcliffe', character: 'Harry', profile_path: '/dan.jpg' }],
        crew: [
            { id: 5, name: 'Chris Columbus', job: 'Director', profile_path: '/cc.jpg' },
            { id: 5, name: 'Chris Columbus', job: 'Producer', profile_path: '/cc.jpg' },
            { id: 9, name: 'Steve Kloves', job: 'Screenplay', profile_path: '/sk.jpg' },
            { id: 12, name: 'J. K. Rowling', job: 'Story', profile_path: null },
            { id: 13, name: 'Bruit de fond', job: 'Gaffer', profile_path: null },
        ],
    },
    release_dates: {
        results: [
            { iso_3166_1: 'US', release_dates: [{ certification: 'PG' }] },
            { iso_3166_1: 'FR', release_dates: [{ certification: '' }, { certification: 'Tous publics' }] },
        ],
    },
};

const COLLECTION = {
    id: 1241,
    name: 'Harry Potter — Saga',
    poster_path: '/saga.jpg',
    parts: [
        { id: 672, title: 'Chambre des secrets', poster_path: '/hp2.jpg', release_date: '2002-11-13', vote_average: 7.7, vote_count: 20000 },
        { id: 671, title: 'École des sorciers', poster_path: '/hp1.jpg', release_date: '2001-11-16', vote_average: 7.9, vote_count: 26000 },
        { id: 673, title: 'Prisonnier d’Azkaban', poster_path: null, backdrop_path: null, release_date: '2004-05-31' },
    ],
};

const SHOW = {
    id: 1396,
    name: 'Breaking Bad',
    overview: 'Un professeur de chimie bascule.',
    poster_path: '/bb.jpg',
    first_air_date: '2008-01-20',
    vote_average: 8.9,
    vote_count: 12000,
    episode_run_time: [47],
    number_of_seasons: 5,
    seasons: [{ season_number: 1, name: 'Saison 1', episode_count: 7, air_date: '2008-01-20' }],
    created_by: [{ id: 66633, name: 'Vince Gilligan', profile_path: '/vg.jpg' }],
    credits: { cast: [], crew: [{ id: 77, name: 'Michelle MacLaren', job: 'Director' }] },
    content_ratings: {
        results: [
            { iso_3166_1: 'US', rating: 'TV-MA' },
            { iso_3166_1: 'FR', rating: '16' },
        ],
    },
};

function searchPage(kind) {
    return {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [
            kind === 'tv'
                ? { id: 1396, name: 'Breaking Bad', poster_path: '/bb.jpg', first_air_date: '2008-01-20', vote_average: 8.9 }
                : { id: 671, title: 'Harry Potter', poster_path: '/hp1.jpg', release_date: '2001-11-16', vote_average: 7.9 },
        ],
    };
}

beforeAll(async () => {
    upstream = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture');
        hits.push(url);
        const send = (body) => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        if (url.pathname === '/3/movie/671') return send(MOVIE);
        if (url.pathname === '/3/tv/1396') return send(SHOW);
        if (url.pathname === '/3/collection/1241') return send(COLLECTION);
        if (url.pathname === '/3/movie/999') return send({ ...MOVIE, id: 999, belongs_to_collection: null });
        if (url.pathname === '/3/collection/404') {
            res.writeHead(404, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ success: false, status_message: 'Not found' }));
        }
        if (url.pathname === '/3/movie/998') {
            return send({ ...MOVIE, id: 998, belongs_to_collection: { id: 404, name: 'Fantôme' } });
        }
        if (url.pathname === '/3/search/movie') return send(searchPage('movie'));
        if (url.pathname === '/3/search/tv') return send(searchPage('tv'));
        if (url.pathname === '/3/search/multi') {
            return send({
                page: 1,
                total_pages: 1,
                total_results: 2,
                results: [
                    { ...searchPage('movie').results[0], media_type: 'movie' },
                    { id: 3, media_type: 'person', name: 'Chris Columbus', profile_path: '/cc.jpg', known_for_department: 'Directing' },
                ],
            });
        }
        send({ page: 1, total_pages: 1, total_results: 0, results: [] });
    });
    await new Promise((resolve) => upstream.listen(0, resolve));

    process.env.TMDB_BASE_URL = `http://localhost:${upstream.address().port}/3`;
    process.env.TMDB_API_KEY = 'details-key';
    process.env.DATA_DIR = dataDir;
    process.env.JWT_SECRET = 'details-secret';
    process.env.TMDB_CACHE_PERSIST = '0';
    app = require('./server');
});

afterAll(async () => {
    await new Promise((resolve) => upstream.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('crew on a fiche', () => {
    it('names the director and the writers, once each', async () => {
        const res = await request(app).get('/api/movie/671');
        expect(res.status).toBe(200);
        expect(res.body.crew.directors).toEqual([
            { id: 5, name: 'Chris Columbus', photo: expect.stringContaining('/cc.jpg') },
        ]);
        expect(res.body.crew.writers.map((w) => w.name)).toEqual(['Steve Kloves', 'J. K. Rowling']);
        expect(res.body.crew.creators).toEqual([]);
    });

    it('drops crew jobs nobody asked about', async () => {
        const res = await request(app).get('/api/movie/671');
        const names = [...res.body.crew.directors, ...res.body.crew.writers].map((p) => p.name);
        expect(names).not.toContain('Bruit de fond');
    });

    it('credits a show to its creators, which live outside the crew list', async () => {
        const res = await request(app).get('/api/tv/1396');
        expect(res.body.crew.creators.map((c) => c.name)).toEqual(['Vince Gilligan']);
    });
});

describe('regional certification', () => {
    it('picks the viewer region and skips empty certifications', async () => {
        const res = await request(app).get('/api/movie/671?region=FR');
        expect(res.body.certification).toBe('Tous publics');
    });

    it('answers with the region actually asked for', async () => {
        const res = await request(app).get('/api/movie/671?region=US');
        expect(res.body.certification).toBe('PG');
    });

    it('reads content_ratings for a show', async () => {
        const res = await request(app).get('/api/tv/1396?region=FR');
        expect(res.body.certification).toBe('16');
    });

    it('stays empty rather than passing off another country’s rating', async () => {
        const res = await request(app).get('/api/movie/671?region=DE');
        expect(res.body.certification).toBe('');
    });
});

describe('saga', () => {
    it('lists the other instalments, chronologically, current one excluded', async () => {
        const res = await request(app).get('/api/movie/671');
        expect(res.body.collection.name).toBe('Harry Potter — Saga');
        expect(res.body.collection.items.map((i) => i.id)).toEqual([672]);
        expect(res.body.collection.items[0].mediaType).toBe('movie');
    });

    it('is null for a standalone film, with no upstream call made', async () => {
        const before = hits.length;
        const res = await request(app).get('/api/movie/999');
        expect(res.body.collection).toBeNull();
        expect(hits.slice(before).some((u) => u.pathname.startsWith('/3/collection/'))).toBe(false);
    });

    it('degrades to null instead of failing the fiche when the saga call errors', async () => {
        const res = await request(app).get('/api/movie/998');
        expect(res.status).toBe(200);
        expect(res.body.title).toBeTruthy();
        expect(res.body.collection).toBeNull();
    });
});

describe('typed search', () => {
    it('hits /search/movie and reports a films-only count', async () => {
        const res = await request(app).get('/api/search?q=harry&type=movie');
        expect(res.status).toBe(200);
        expect(hits.at(-1).pathname).toBe('/3/search/movie');
        expect(res.body.results.every((r) => r.mediaType === 'movie')).toBe(true);
        expect(res.body.people).toEqual([]);
    });

    it('hits /search/tv for shows', async () => {
        const res = await request(app).get('/api/search?q=breaking&type=tv');
        expect(hits.at(-1).pathname).toBe('/3/search/tv');
        expect(res.body.results[0]).toMatchObject({ id: 1396, mediaType: 'tv' });
    });

    it('falls back to the multi search on an unknown type, people included', async () => {
        const res = await request(app).get('/api/search?q=chris&type=$(evil)');
        expect(hits.at(-1).pathname).toBe('/3/search/multi');
        expect(res.body.people.map((p) => p.name)).toEqual(['Chris Columbus']);
    });
});
