import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated store: requireAuth now checks tokens against live accounts, so the
// data dir must be set before ./auth pulls in ./store.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-auth-test-'));
process.env.DATA_DIR = dataDir;

const jwt = require('jsonwebtoken');
const auth = require('./auth');
const store = require('./store');

afterAll(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Drives `requireAuth` with a stub req/res and reports what happened. */
function callRequireAuth(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const result = { status: null, body: null, passed: false, userId: undefined };
  const res = {
    status(code) {
      result.status = code;
      return res;
    },
    json(payload) {
      result.body = payload;
      return res;
    },
  };
  auth.requireAuth(req, res, () => {
    result.passed = true;
    result.userId = req.userId;
  });
  return result;
}

describe('JWT secret configuration', () => {
  it('refuses to boot in production without JWT_SECRET', () => {
    expect(() => auth.assertSecretConfigured('production', undefined)).toThrow(
      /JWT_SECRET is required/,
    );
  });

  it('refuses to boot in production when JWT_SECRET is empty', () => {
    expect(() => auth.assertSecretConfigured('production', '')).toThrow(/JWT_SECRET is required/);
  });

  it('boots in production once JWT_SECRET is set', () => {
    expect(() => auth.assertSecretConfigured('production', 'a-real-secret')).not.toThrow();
  });

  it('still boots without JWT_SECRET outside production', () => {
    expect(() => auth.assertSecretConfigured('development', undefined)).not.toThrow();
    expect(() => auth.assertSecretConfigured(undefined, undefined)).not.toThrow();
  });
});

describe('requireAuth', () => {
  it('accepts a token for a live account', async () => {
    const user = await store.createUser({ email: 'demo@neox.test', passwordHash: 'x' });
    const token = auth.signToken(user);

    expect(callRequireAuth(token)).toMatchObject({ passed: true, userId: user.id });
  });

  it('rejects a valid token whose account no longer exists', () => {
    const token = auth.signToken({ id: 'ghost', email: 'ghost@neox.test' });

    expect(callRequireAuth(token)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
  });

  it('rejects a token issued before the last password change', async () => {
    const user = await store.createUser({ email: 'rotate@neox.test', passwordHash: 'x' });
    const old = auth.signToken(user); // no `pwc` claim yet
    await store.updateUser(user.id, { passwordChangedAt: Date.now() });

    expect(callRequireAuth(old)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
  });

  it('accepts the fresh token issued right after a password change', async () => {
    const user = await store.createUser({ email: 'fresh@neox.test', passwordHash: 'x' });
    await store.updateUser(user.id, { passwordChangedAt: Date.now() });
    const fresh = auth.signToken(user); // carries the matching `pwc` claim

    expect(callRequireAuth(fresh)).toMatchObject({ passed: true, userId: user.id });
  });

  it('rejects a token issued before the sessions were revoked', async () => {
    const user = await store.createUser({ email: 'revoke@neox.test', passwordHash: 'x' });
    const old = auth.signToken(user); // no `srv` claim yet
    const updated = await store.updateUser(user.id, { sessionsRevokedAt: Date.now() });

    expect(callRequireAuth(old)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
    // The token minted right after carries the matching stamp and survives, so
    // "sign my other devices out" doesn't sign this one out too.
    expect(callRequireAuth(auth.signToken(updated))).toMatchObject({ passed: true, userId: user.id });
  });

  it('keeps the two revocation stamps independent', async () => {
    const user = await store.createUser({ email: 'both@neox.test', passwordHash: 'x' });
    await store.updateUser(user.id, { sessionsRevokedAt: Date.now() });
    const afterRevoke = auth.signToken(store.getUserById(user.id));
    const updated = await store.updateUser(user.id, { passwordChangedAt: Date.now() });

    // A password change invalidates a token that already matched the revocation
    // stamp: matching one is not enough, a token has to match both.
    expect(callRequireAuth(afterRevoke)).toMatchObject({ passed: false, status: 401 });
    expect(callRequireAuth(auth.signToken(updated))).toMatchObject({ passed: true, userId: user.id });
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 'u1', email: 'demo@neox.test' }, 'not-the-server-secret');

    expect(callRequireAuth(forged)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'u1' }, 'neox-dev-secret-change-me', { expiresIn: '-1s' });

    expect(callRequireAuth(expired)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
  });

  it('rejects a request with no bearer token', () => {
    expect(callRequireAuth(null)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_REQUIRED' },
    });
  });
});
