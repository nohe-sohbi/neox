/**
 * Integration tests for the TMDB client's network path, against a local
 * fixture server injected via TMDB_BASE_URL. This is the layer no pure unit
 * test could reach: URL building, retry on 429, and what ends up in the
 * cache snapshot on disk.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SECRET_KEY = 'super-secret-tmdb-key';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-tmdb-test-'));

let server;
let tmdb;
const hits = []; // every URL the fixture received, in order
let failuresLeft = 0; // how many 429s to serve before succeeding

beforeAll(async () => {
    server = http.createServer((req, res) => {
        hits.push(req.url);
        if (failuresLeft > 0) {
            failuresLeft -= 1;
            res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' });
            res.end(JSON.stringify({ success: false, status_message: 'rate limited' }));
            return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
            JSON.stringify({
                page: 1,
                total_pages: 1,
                total_results: 1,
                results: [
                    {
                        id: 42,
                        media_type: 'movie',
                        title: 'Fixture Film',
                        poster_path: '/fixture.jpg',
                        release_date: '2020-01-01',
                        vote_average: 7.25,
                        vote_count: 100,
                    },
                    {
                        id: 7,
                        media_type: 'person',
                        name: 'Fixture Actor',
                        profile_path: '/actor.jpg',
                        known_for_department: 'Acting',
                    },
                ],
            }),
        );
    });
    await new Promise((resolve) => server.listen(0, resolve));

    process.env.TMDB_BASE_URL = `http://localhost:${server.address().port}/3`;
    process.env.TMDB_API_KEY = SECRET_KEY;
    process.env.DATA_DIR = dataDir;
    tmdb = require('./tmdb');
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('retryDelayMs', () => {
    it('honors a sane Retry-After header', () => {
        expect(tmdb.retryDelayMs('2', 1)).toBe(2000);
    });

    it('caps a hostile Retry-After instead of stalling for an hour', () => {
        expect(tmdb.retryDelayMs('3600', 1)).toBe(10000);
    });

    it('falls back to the attempt number when the header is missing or junk', () => {
        expect(tmdb.retryDelayMs(null, 2)).toBe(2000);
        expect(tmdb.retryDelayMs('soon', 3)).toBe(3000);
        expect(tmdb.retryDelayMs('0', 1)).toBe(1000);
        expect(tmdb.retryDelayMs('-5', 1)).toBe(1000);
    });
});

describe('tmdb client over the wire', () => {
    it('sends the api key upstream and normalizes the payload', async () => {
        const res = await tmdb.search('fixture');
        expect(hits.at(-1)).toContain(`api_key=${SECRET_KEY}`);
        expect(res.results).toHaveLength(1);
        expect(res.results[0]).toMatchObject({
            id: 42,
            mediaType: 'movie',
            title: 'Fixture Film',
            year: '2020',
            rating: 7.3,
        });
        expect(res.results[0].poster).toContain('/fixture.jpg');
    });

    it('surfaces people alongside titles instead of dropping them', async () => {
        const res = await tmdb.search('people please');
        expect(res.results).toHaveLength(1); // the person is not a title…
        expect(res.people).toHaveLength(1); // …but it is not lost either
        expect(res.people[0]).toMatchObject({ id: 7, name: 'Fixture Actor', knownFor: 'Acting' });
        expect(res.people[0].photo).toContain('/actor.jpg');
    });

    it('retries after a 429 and succeeds', async () => {
        failuresLeft = 1;
        const before = hits.length;
        const res = await tmdb.search('retry me');
        expect(res.results).toHaveLength(1);
        expect(hits.length - before).toBe(2); // the 429 + the successful retry
    }, 15000);

    it('keeps the api key out of the cache snapshot on disk', async () => {
        await tmdb.search('snapshot me');
        expect(await tmdb.persistCache()).toBe(true);

        const raw = fs.readFileSync(path.join(dataDir, 'tmdb-cache.json'), 'utf8');
        expect(raw).not.toContain(SECRET_KEY);

        const { entries } = JSON.parse(raw);
        expect(entries.length).toBeGreaterThan(0);
        for (const { key } of entries) {
            expect(key.startsWith('/search/multi?')).toBe(true);
        }
    });
});
