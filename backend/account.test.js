import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate the data store and pin a secret BEFORE the app (and store) load.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-account-test-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('./server');

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const creds = { email: 'owner@example.com', password: 'supersecret1' };
const bearer = (token) => ['Authorization', `Bearer ${token}`];

/** Account-scoped state: preferences sync, library revisions, export, sessions. */
describe('preferences sync', () => {
  let token;

  it('registers the account used by this suite', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    token = res.body.token;
  });

  it('requires a token', async () => {
    expect((await request(app).get('/api/preferences')).status).toBe(401);
  });

  it('is never cached', async () => {
    const res = await request(app).get('/api/preferences').set(...bearer(token));
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('reports null until the account saves something', async () => {
    const res = await request(app).get('/api/preferences').set(...bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.preferences).toBeNull();
  });

  it('rejects a body that is not an object', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(...bearer(token))
      .send({ preferences: [1, 2] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PREFERENCES_INVALID_BODY');
  });

  it('stores sanitized preferences and reads them back', async () => {
    const put = await request(app)
      .put('/api/preferences')
      .set(...bearer(token))
      .send({ preferences: { platforms: [8, 8, 'x', 119], region: 'be', librarySort: 'nope' } });

    expect(put.status).toBe(200);
    expect(put.body.preferences).toMatchObject({
      platforms: [8, 119],
      region: 'BE',
      librarySort: 'added_desc',
    });

    const get = await request(app).get('/api/preferences').set(...bearer(token));
    expect(get.body.preferences.platforms).toEqual([8, 119]);
  });

  it('merges a partial update onto what is stored', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(...bearer(token))
      .send({ preferences: { libraryFilter: 'watching' } });

    expect(res.body.preferences).toMatchObject({
      platforms: [8, 119],
      region: 'BE',
      libraryFilter: 'watching',
    });
  });
});

describe('library revisions', () => {
  let token;
  const entry = { id: 550, mediaType: 'movie', title: 'Fight Club', status: 'want' };

  it('signs in', async () => {
    const res = await request(app).post('/api/auth/login').send(creds);
    token = res.body.token;
  });

  it('starts at revision 0 and bumps on write', async () => {
    const before = await request(app).get('/api/library').set(...bearer(token));
    expect(before.body.rev).toBe(0);

    const put = await request(app)
      .put('/api/library')
      .set(...bearer(token))
      .send({ entries: [entry], rev: 0 });
    expect(put.status).toBe(200);
    expect(put.body.rev).toBe(1);
  });

  it('refuses a write against a stale revision and hands back the server state', async () => {
    const res = await request(app)
      .put('/api/library')
      .set(...bearer(token))
      .send({ entries: [], rev: 0 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LIBRARY_CONFLICT');
    expect(res.body.rev).toBe(1);
    expect(res.body.entries).toHaveLength(1);
  });

  it('accepts the same write once the client is on the current revision', async () => {
    const res = await request(app)
      .put('/api/library')
      .set(...bearer(token))
      .send({ entries: [{ ...entry, status: 'watched' }], rev: 1 });

    expect(res.status).toBe(200);
    expect(res.body.rev).toBe(2);
    expect(res.body.entries[0].status).toBe('watched');
  });

  it('still force-replaces when no revision is sent', async () => {
    const res = await request(app)
      .put('/api/library')
      .set(...bearer(token))
      .send({ entries: [entry] });

    expect(res.status).toBe(200);
    expect(res.body.rev).toBe(3);
  });

  it('bumps the revision on merge too', async () => {
    const res = await request(app)
      .post('/api/library/merge')
      .set(...bearer(token))
      .send({ entries: [{ id: 1399, mediaType: 'tv', title: 'GoT' }] });

    expect(res.body.rev).toBe(4);
    expect(res.body.entries).toHaveLength(2);
  });
});

describe('account data and sessions', () => {
  let token;

  it('signs in', async () => {
    const res = await request(app).post('/api/auth/login').send(creds);
    token = res.body.token;
  });

  it('exports account, preferences and library in one document', async () => {
    const res = await request(app).get('/api/auth/export').set(...bearer(token));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body).toMatchObject({ app: 'neox', type: 'account', version: 1 });
    expect(res.body.account.email).toBe(creds.email);
    expect(res.body.account.passwordHash).toBeUndefined();
    expect(res.body.preferences.region).toBe('BE');
    // Top-level `entries` so the export doubles as a library backup.
    expect(res.body.entries).toHaveLength(2);
  });

  it('requires a token to export', async () => {
    expect((await request(app).get('/api/auth/export')).status).toBe(401);
  });

  it('revokes other sessions and keeps the caller signed in', async () => {
    const stale = token;
    const res = await request(app).post('/api/auth/logout-all').set(...bearer(stale));

    expect(res.status).toBe(200);
    token = res.body.token;
    expect(token).toBeTruthy();

    expect((await request(app).get('/api/library').set(...bearer(stale))).status).toBe(401);
    expect((await request(app).get('/api/library').set(...bearer(token))).status).toBe(200);
  });

  it('survives a password change after a revocation', async () => {
    // The two stamps are independent, so a token has to satisfy both: this is
    // the case that would break if either one overwrote the other.
    const next = 'an-even-better-password';
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(...bearer(token))
      .send({ currentPassword: creds.password, newPassword: next });

    expect(res.status).toBe(200);
    creds.password = next;
    token = res.body.token;
    expect((await request(app).get('/api/auth/me').set(...bearer(token))).status).toBe(200);
  });

  it('drops preferences and revisions along with the account', async () => {
    const del = await request(app)
      .delete('/api/auth/account')
      .set(...bearer(token))
      .send({ password: creds.password });
    expect(del.status).toBe(200);

    // The e-mail is free again, and the new account starts blank: nothing of the
    // deleted one survived under the same id space.
    const fresh = await request(app).post('/api/auth/register').send(creds);
    expect(fresh.status).toBe(201);

    const lib = await request(app).get('/api/library').set(...bearer(fresh.body.token));
    expect(lib.body.entries).toHaveLength(0);
    expect(lib.body.rev).toBe(0);
    const prefs = await request(app).get('/api/preferences').set(...bearer(fresh.body.token));
    expect(prefs.body.preferences).toBeNull();
  });
});
