/**
 * Self-contained auth: bcrypt password hashing + stateless JWTs.
 * No third-party SaaS required — set JWT_SECRET in production.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'neox-dev-secret-change-me';
const TOKEN_TTL = '30d';

const usingDefaultSecret = !process.env.JWT_SECRET;

function signToken(user) {
    return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: TOKEN_TTL });
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
        return res.status(401).json({ error: 'Authentification requise.' });
    }
    try {
        const payload = jwt.verify(token, SECRET);
        req.userId = payload.sub;
        next();
    } catch {
        res.status(401).json({ error: 'Session expirée ou invalide.' });
    }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials({ email, password }) {
    if (!email || !EMAIL_RE.test(String(email))) {
        return 'Adresse e-mail invalide.';
    }
    if (!password || String(password).length < 8) {
        return 'Le mot de passe doit faire au moins 8 caractères.';
    }
    return null;
}

module.exports = {
    signToken,
    hashPassword,
    verifyPassword,
    requireAuth,
    validateCredentials,
    usingDefaultSecret,
};
