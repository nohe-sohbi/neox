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
    // `tv` pins the token to a generation of the account. Tokens minted before a
    // password change or a "log out everywhere" carry an older number and stop
    // verifying, without keeping server-side session state. Tokens issued before
    // this claim existed decode to `tv: undefined`, which reads as generation 0,
    // so accounts created by an earlier version stay logged in.
    return jwt.sign({ sub: user.id, email: user.email, tv: user.tokenVersion || 0 }, SECRET, {
        expiresIn: TOKEN_TTL,
    });
}

function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

const SESSION_INVALID = { error: 'Session expirée ou invalide.', code: 'AUTH_SESSION_INVALID' };

/**
 * Express middleware: requires a valid Bearer token, sets req.userId.
 *
 * A valid signature is necessary but not sufficient. The account must still
 * exist (a deleted account's token must stop working immediately, otherwise it
 * could keep writing a library for a user id nobody owns) and the token's
 * generation must match the stored one (see `signToken`).
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
    }
    let payload;
    try {
        payload = jwt.verify(token, SECRET);
    } catch {
        return res.status(401).json(SESSION_INVALID);
    }

    const user = store.getUserById(payload.sub);
    if (!user || (user.tokenVersion || 0) !== (payload.tv || 0)) {
        return res.status(401).json(SESSION_INVALID);
    }

    req.userId = user.id;
    next();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns { error, code } on failure (so clients can localize by code, with the
// message as a fallback), or null when the password is acceptable.
function validatePassword(password) {
    if (!password || String(password).length < 8) {
        return { error: 'Le mot de passe doit faire au moins 8 caractères.', code: 'AUTH_PASSWORD_TOO_SHORT' };
    }
    return null;
}

// Same contract, for the pair. Registration checks both; changing a password
// only has one to check.
function validateCredentials({ email, password }) {
    if (!email || !EMAIL_RE.test(String(email))) {
        return { error: 'Adresse e-mail invalide.', code: 'AUTH_EMAIL_INVALID' };
    }
    return validatePassword(password);
}

module.exports = {
    signToken,
    hashPassword,
    verifyPassword,
    requireAuth,
    validateCredentials,
    validatePassword,
    assertSecretConfigured,
    usingDefaultSecret,
};
