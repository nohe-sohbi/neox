import { describe, expect, it } from 'vitest';

const jwt = require('jsonwebtoken');
const auth = require('./auth');

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
  it('accepts a token the module signed itself', () => {
    const token = auth.signToken({ id: 'u1', email: 'demo@neox.test' });

    expect(callRequireAuth(token)).toMatchObject({ passed: true, userId: 'u1' });
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
