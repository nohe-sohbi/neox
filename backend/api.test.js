import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate the data store and pin a secret BEFORE the app (and store) load.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-test-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('./server');

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('auth + library sync', () => {
  const creds = { email: 'tester@example.com', password: 'supersecret1' };
  let token;

  it('rejects weak passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('registers a new account', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(creds.email);
    token = res.body.token;
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });

  it('rejects wrong password on login', async () => {
    const res = await request(app).post('/api/auth/login').send({ ...creds, password: 'nope12345' });
    expect(res.status).toBe(401);
  });

  it('requires a token for library access', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(401);
  });

  it('stores and reads back a sanitized library', async () => {
    const put = await request(app)
      .put('/api/library')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entries: [
          { id: 550, mediaType: 'movie', title: 'Fight Club', status: 'watched', personalRating: 9 },
          { id: 0, mediaType: 'movie' }, // invalid → dropped
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.entries).toHaveLength(1);

    const get = await request(app).get('/api/library').set('Authorization', `Bearer ${token}`);
    expect(get.body.entries[0]).toMatchObject({ id: 550, status: 'watched', personalRating: 9 });
  });

  it('merges incoming entries with the stored library', async () => {
    const res = await request(app)
      .post('/api/library/merge')
      .set('Authorization', `Bearer ${token}`)
      .send({ entries: [{ id: 1399, mediaType: 'tv', title: 'GoT', status: 'want' }] });
    expect(res.status).toBe(200);
    const ids = res.body.entries.map((e) => e.id).sort((a, b) => a - b);
    expect(ids).toEqual([550, 1399]);
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('tv season endpoint', () => {
  it('rejects a non-numeric tv id', async () => {
    const res = await request(app).get('/api/tv/abc/season/1');
    expect(res.status).toBe(400);
  });

  it('rejects a negative season number', async () => {
    const res = await request(app).get('/api/tv/1399/season/-1');
    expect(res.status).toBe(400);
  });

  it('accepts a valid request and delegates upstream', async () => {
    // What this asserts is routing + validation, not upstream behaviour: the
    // request must reach the TMDB client instead of dying on a 400/404. The
    // outcome then depends on the environment, and both are correct here, so
    // the suite stays green whether or not a developer has a real key in .env.
    const res = await request(app).get('/api/tv/1399/season/1');
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) expect(res.body.code).toBe('TMDB_NOT_CONFIGURED');
  });
});

describe('crawler directives', () => {
  // A JSON payload has no business ranking as a document, but the endpoints
  // must stay fetchable: the app is client rendered, so Googlebot calls them
  // while rendering. Hence a header rather than a robots.txt Disallow, which
  // would be read before the fetch and leave it rendering an empty app.
  it('marks API responses noindex without blocking the fetch', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-robots-tag']).toBe('noindex');
  });

  it('marks error responses too, so a 404 body cannot be indexed either', async () => {
    const res = await request(app).get('/api/movie/abc');
    expect(res.headers['x-robots-tag']).toBe('noindex');
  });
});
