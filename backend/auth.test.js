import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// `requireAuth` checks the account behind the token, so the store must be
// isolated before it (and therefore auth) is loaded.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-auth-test-'));
process.env.DATA_DIR = tmpDir;

const jwt = require('jsonwebtoken');
const store = require('./store');
const auth = require('./auth');

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

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
  let user;

  beforeAll(async () => {
    user = await store.createUser({ email: 'demo@neox.test', passwordHash: 'x' });
  });

  it('accepts a token the module signed itself', () => {
    const token = auth.signToken(user);

    expect(callRequireAuth(token)).toMatchObject({ passed: true, userId: user.id });
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: user.id, email: user.email }, 'not-the-server-secret');

    expect(callRequireAuth(forged)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: user.id }, 'neox-dev-secret-change-me', { expiresIn: '-1s' });

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

  it('rejects a well-signed token for an account that no longer exists', () => {
    const orphan = auth.signToken({ id: 'deleted-user', email: 'gone@neox.test' });

    expect(callRequireAuth(orphan)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
  });

  it('accepts a token issued before the tokenVersion claim existed', () => {
    // Legacy token: signed by an older build, so no `tv`. It must keep working
    // against an account still on generation 0, otherwise deploying this change
    // would log everyone out.
    const legacy = jwt.sign({ sub: user.id, email: user.email }, 'neox-dev-secret-change-me');

    expect(callRequireAuth(legacy)).toMatchObject({ passed: true, userId: user.id });
  });

  it('rejects tokens minted before the sessions were revoked', async () => {
    const before = auth.signToken(store.getUserById(user.id));
    const revoked = await store.revokeSessions(user.id);
    const after = auth.signToken(revoked);

    expect(callRequireAuth(before)).toMatchObject({
      passed: false,
      status: 401,
      body: { code: 'AUTH_SESSION_INVALID' },
    });
    expect(callRequireAuth(after)).toMatchObject({ passed: true, userId: user.id });
  });
});
