import { describe, expect, it } from 'vitest';
const express = require('express');
const request = require('supertest');
const { cacheControl, noStore, TTL } = require('./http-cache');

/** Minimal app exercising the middlewares in isolation (no TMDB needed). */
function makeApp() {
    const app = express();
    app.set('etag', 'strong');
    app.get('/ok', cacheControl(TTL.static), (_req, res) => res.json({ hello: 'world' }));
    app.get('/private', noStore, (_req, res) => res.json({ secret: true }));
    app.get('/boom', cacheControl(TTL.static), (_req, res) =>
        res.status(503).json({ error: 'upstream down' }),
    );
    return app;
}

describe('cacheControl', () => {
    it('marks successful responses as publicly cacheable with SWR', async () => {
        const res = await request(makeApp()).get('/ok');
        expect(res.status).toBe(200);
        const cc = res.headers['cache-control'];
        expect(cc).toContain('public');
        expect(cc).toContain(`max-age=${TTL.static}`);
        expect(cc).toContain('stale-while-revalidate=');
    });

    it('marks error responses as explicitly non-cacheable (no-store)', async () => {
        const res = await request(makeApp()).get('/boom');
        expect(res.status).toBe(503);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('serves a 304 when the ETag still matches', async () => {
        const app = makeApp();
        const first = await request(app).get('/ok');
        const etag = first.headers.etag;
        expect(etag).toBeTruthy();

        const second = await request(app).get('/ok').set('If-None-Match', etag);
        expect(second.status).toBe(304);
        expect(second.text).toBe('');
    });
});

describe('noStore', () => {
    it('opts the response out of every cache', async () => {
        const res = await request(makeApp()).get('/private');
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });
});
