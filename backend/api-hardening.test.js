/**
 * Hardening tests: what the API lets through to TMDB, and how it fails.
 * A local fixture server stands in for TMDB (via TMDB_BASE_URL) and records
 * every upstream URL, so the tests can assert what was actually sent.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-hardening-'));

let upstream;
let app;
const hits = [];

beforeAll(async () => {
    upstream = http.createServer((req, res) => {
        hits.push(new URL(req.url, 'http://fixture'));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ page: 1, total_pages: 1, total_results: 0, results: [] }));
    });
    await new Promise((resolve) => upstream.listen(0, resolve));

    process.env.TMDB_BASE_URL = `http://localhost:${upstream.address().port}/3`;
    process.env.TMDB_API_KEY = 'hardening-key';
    process.env.DATA_DIR = dataDir;
    process.env.JWT_SECRET = 'hardening-secret';
    app = require('./server');
});

afterAll(async () => {
    await new Promise((resolve) => upstream.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

const lastHit = () => hits.at(-1);

describe('auth input hardening', () => {
    it('rejects a non-string login email with 400, not 500', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 123, password: {} });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('AUTH_CREDENTIALS_REQUIRED');
    });

    it('rejects an array email at register (String([]) used to slip through)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: ['user@example.com'], password: 'longenough' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('AUTH_EMAIL_INVALID');
    });
});

describe('discover query hardening', () => {
    it('replaces an unknown sort with the default instead of forwarding it', async () => {
        await request(app).get('/api/discover/movie?sort=$evil|inject');
        expect(lastHit().searchParams.get('sort_by')).toBe('popularity.desc');
    });

    it('keeps a legitimate sort', async () => {
        await request(app).get('/api/discover/movie?sort=vote_average.desc');
        expect(lastHit().searchParams.get('sort_by')).toBe('vote_average.desc');
    });

    it('clamps the page to TMDB’s maximum of 500', async () => {
        await request(app).get('/api/discover/movie?page=99999');
        expect(lastHit().searchParams.get('page')).toBe('500');
    });

    it('drops non-numeric provider ids and keeps the numeric ones', async () => {
        await request(app).get('/api/discover/movie?providers=abc,8,--,337');
        expect(lastHit().searchParams.get('with_watch_providers')).toBe('8|337');
    });

    it('ignores a malformed region and language instead of forwarding them', async () => {
        await request(app).get('/api/discover/movie?region=europe&lang=<script>');
        expect(lastHit().searchParams.get('region')).toBe('FR');
        expect(lastHit().searchParams.get('language')).toBe('fr-FR');
    });
});

describe('search query hardening', () => {
    it('clamps the page floor and ceiling', async () => {
        await request(app).get('/api/search?q=test&page=0');
        expect(lastHit().searchParams.get('page')).toBe('1');
        await request(app).get('/api/search?q=test&page=1e9');
        expect(lastHit().searchParams.get('page')).toBe('500');
    });

    it('bounds the query length', async () => {
        await request(app).get(`/api/search?q=${'a'.repeat(1000)}`);
        expect(lastHit().searchParams.get('query')).toHaveLength(200);
    });
});

describe('library merge contract', () => {
    it('rejects a non-array merge body like PUT does', async () => {
        const reg = await request(app)
            .post('/api/auth/register')
            .send({ email: 'merge-check@example.com', password: 'longenough' });
        expect(reg.status).toBe(201);

        const res = await request(app)
            .post('/api/library/merge')
            .set('Authorization', `Bearer ${reg.body.token}`)
            .send({ entries: 'nope' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('LIBRARY_INVALID_BODY');
    });
});
