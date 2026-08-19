/**
 * Self-contained auth: bcrypt password hashing + stateless JWTs.
 * No third-party SaaS required: set JWT_SECRET in production.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('./store');

const SECRET = process.env.JWT_SECRET || 'neox-dev-secret-change-me';
const TOKEN_TTL = '30d';

const usingDefaultSecret = !process.env.JWT_SECRET;

/**
 * The fallback secret is public: it is written right above, in a file anyone
 * can read. Signing with it lets a stranger mint a valid token for any account,
 * so it is a full auth bypass, not a warning-level smell. Zero-config startup
 * is worth keeping in dev; in production we refuse to boot instead.
 *
 * Exported so the rule can be tested directly (requiring the module a second
 * time would just hit the CommonJS cache).
 */
function assertSecretConfigured(nodeEnv = process.env.NODE_ENV, secret = process.env.JWT_SECRET) {
    if (!secret && nodeEnv === 'production') {
        throw new Error(
            'JWT_SECRET is required when NODE_ENV=production. Refusing to sign tokens with the ' +
                'built-in development secret. Generate one with: openssl rand -hex 32',
        );
    }
}

assertSecretConfigured();

function signToken(user) {
    const payload = { sub: user.id, email: user.email };
    // The token pins the password-change timestamp it was issued against, so
    // requireAuth can reject every token that predates a change exactly: the
    // `iat` claim only counts seconds, which is too coarse for that.
    if (user.passwordChangedAt) payload.pwc = user.passwordChangedAt;
    // Same mechanism for an explicit "sign my other devices out", which is not a
    // password change and must not be recorded as one. Two independent stamps
    // rather than one shared field: each answers a different question, and a
    // token has to match both.
    if (user.sessionsRevokedAt) payload.srv = user.sessionsRevokedAt;
    return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL });
}

function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/** Express middleware: requires a valid Bearer token, sets req.userId. */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
    }
    try {
        const payload = jwt.verify(token, SECRET);
        // A valid signature is not enough: the token must still map to a live
        // account (a deleted account's tokens die instantly), and its `pwc`
        // claim must match the account's last password change: changing the
        // password is the user's "log every other session out" lever, which
        // stateless JWTs can't offer otherwise.
        const user = store.getUserById(payload.sub);
        const stale =
            user &&
            ((user.passwordChangedAt && payload.pwc !== user.passwordChangedAt) ||
                (user.sessionsRevokedAt && payload.srv !== user.sessionsRevokedAt));
        if (!user || stale) {
            return res
                .status(401)
                .json({ error: 'Session expirée ou invalide.', code: 'AUTH_SESSION_INVALID' });
        }
        req.userId = payload.sub;
        next();
    } catch {
        res.status(401).json({ error: 'Session expirée ou invalide.', code: 'AUTH_SESSION_INVALID' });
    }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns { error, code } on failure (so clients can localize by code, with the
// message as a fallback), or null when the credentials are well-formed.
function validateCredentials({ email, password }) {
    // Types first: a JSON body can carry anything (arrays, objects, numbers),
    // and String([]) coercions used to let some of it through to the store.
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
        return { error: 'Adresse e-mail invalide.', code: 'AUTH_EMAIL_INVALID' };
    }
    if (typeof password !== 'string' || password.length < 8) {
        return { error: 'Le mot de passe doit faire au moins 8 caractères.', code: 'AUTH_PASSWORD_TOO_SHORT' };
    }
    return null;
}

module.exports = {
    signToken,
    hashPassword,
    verifyPassword,
    requireAuth,
    validateCredentials,
    assertSecretConfigured,
    usingDefaultSecret,
};
