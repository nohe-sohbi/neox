/**
 * NEOX API — a thin, cached proxy in front of TMDB.
 *
 * The frontend never talks to TMDB directly: the key stays server-side, every
 * response is normalized to a compact shape, and a shared cache keeps us fast
 * and well under rate limits.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const tmdb = require('./tmdb');
const store = require('./store');
const auth = require('./auth');
const { sanitizeLibrary, mergeLibraries } = require('./library');
const { cacheControl, noStore, TTL } = require('./http-cache');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1); // honor X-Forwarded-* behind a reverse proxy
app.set('etag', 'strong'); // strong ETags → cheap 304s on unchanged payloads
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors());
// Sized to fit a full library (sanitizeLibrary caps at 2000 entries, ~400 KB
// serialized) so PUT/POST /api/library never 413 before validation runs.
app.use(express.json({ limit: '1mb' }));

// Generous global limiter + a strict one for auth to blunt brute force.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// Tiny request logger — quiet but useful in dev.
app.use((req, _res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`${req.method} ${req.originalUrl}`);
    }
    next();
});

const MEDIA_TYPES = new Set(['movie', 'tv']);

/** Wraps an async route so thrown errors hit the error middleware cleanly. */
const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function assertMediaType(value) {
    if (!MEDIA_TYPES.has(value)) {
        const err = new Error(`Unsupported media type "${value}". Use "movie" or "tv".`);
        err.status = 400;
        throw err;
    }
    return value;
}

// Pulls region + language overrides off any request.
function localeFrom(req) {
    return {
        region: req.query.region ? req.query.region.toString().toUpperCase() : undefined,
        language: req.query.lang ? req.query.lang.toString() : undefined,
    };
}

app.get('/api/health', noStore, (_req, res) => {
    res.json({
        status: 'ok',
        tmdb: tmdb.isConfigured() ? 'configured' : 'missing-key',
        cache: tmdb.cacheStats(),
        uptime: Math.round(process.uptime()),
    });
});

app.get(
    '/api/home',
    cacheControl(TTL.dynamic),
    route(async (req, res) => {
        const { region, language } = localeFrom(req);
        res.json(await tmdb.home(region || tmdb.DEFAULT_REGION, { language }));
    }),
);

app.get(
    '/api/search',
    cacheControl(TTL.dynamic),
    route(async (req, res) => {
        const q = (req.query.q || '').toString();
        const page = Math.max(1, Number(req.query.page) || 1);
        res.json(await tmdb.search(q, page, localeFrom(req)));
    }),
);

app.get(
    '/api/genres/:mediaType',
    cacheControl(TTL.static),
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        res.json({ genres: await tmdb.getGenres(mediaType, localeFrom(req)) });
    }),
);

app.get(
    '/api/providers/:mediaType',
    cacheControl(TTL.static),
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        const region = (req.query.region || tmdb.DEFAULT_REGION).toString().toUpperCase();
        res.json({ providers: await tmdb.getProviders(mediaType, region) });
    }),
);

app.get(
    '/api/discover/:mediaType',
    cacheControl(TTL.dynamic),
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        const { genre, sort, providers, region, year, minRating } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const providerIds = providers
            ? providers
                  .toString()
                  .split(',')
                  .map((id) => id.trim())
                  .filter(Boolean)
            : undefined;
        res.json(
            await tmdb.discover(mediaType, {
                genre: genre ? Number(genre) : undefined,
                sort: sort ? sort.toString() : undefined,
                providers: providerIds,
                region: region ? region.toString() : undefined,
                language: req.query.lang ? req.query.lang.toString() : undefined,
                year: year ? Number(year) : undefined,
                minRating: minRating ? Number(minRating) : undefined,
                page,
            }),
        );
    }),
);

app.get(
    '/api/trending/:mediaType',
    cacheControl(TTL.dynamic),
    route(async (req, res) => {
        const mediaType = ['all', 'movie', 'tv'].includes(req.params.mediaType)
            ? req.params.mediaType
            : 'all';
        const window = req.query.window === 'day' ? 'day' : 'week';
        res.json(await tmdb.trending(mediaType, window, localeFrom(req)));
    }),
);

app.get(
    '/api/person/:id',
    cacheControl(TTL.details),
    route(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            const err = new Error('Invalid id.');
            err.status = 400;
            throw err;
        }
        res.json(await tmdb.getPerson(id, localeFrom(req)));
    }),
);

app.post(
    '/api/recommendations',
    route(async (req, res) => {
        const seeds = Array.isArray(req.body?.seeds) ? req.body.seeds : [];
        res.json(await tmdb.recommend(seeds, localeFrom(req)));
    }),
);

/* ------------------------------- auth --------------------------------- */

// Auth + library responses are per-user and must never be cached by anyone.
app.use(['/api/auth', '/api/library'], noStore);

app.post(
    '/api/auth/register',
    route(async (req, res) => {
        const { email, password } = req.body || {};
        const validationError = auth.validateCredentials({ email, password });
        if (validationError) return res.status(400).json(validationError);

        if (store.findUserByEmail(email)) {
            return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.', code: 'AUTH_EMAIL_TAKEN' });
        }

        const passwordHash = await auth.hashPassword(password);
        const user = await store.createUser({ email, passwordHash });
        res.status(201).json({ token: auth.signToken(user), user: store.publicUser(user) });
    }),
);

app.post(
    '/api/auth/login',
    route(async (req, res) => {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'E-mail et mot de passe requis.', code: 'AUTH_CREDENTIALS_REQUIRED' });
        }
        const user = store.findUserByEmail(email);
        const ok = user && (await auth.verifyPassword(password, user.passwordHash));
        if (!ok) {
            return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.', code: 'AUTH_INVALID_CREDENTIALS' });
        }
        res.json({ token: auth.signToken(user), user: store.publicUser(user) });
    }),
);

app.get('/api/auth/me', auth.requireAuth, (req, res) => {
    const user = store.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Compte introuvable.', code: 'AUTH_ACCOUNT_NOT_FOUND' });
    res.json({ user: store.publicUser(user) });
});

/* ------------------------------ library ------------------------------- */

app.get('/api/library', auth.requireAuth, (req, res) => {
    res.json({ entries: store.getLibrary(req.userId) });
});

app.put(
    '/api/library',
    auth.requireAuth,
    route(async (req, res) => {
        const entries = sanitizeLibrary(req.body?.entries);
        await store.setLibrary(req.userId, entries);
        res.json({ entries });
    }),
);

app.post(
    '/api/library/merge',
    auth.requireAuth,
    route(async (req, res) => {
        const incoming = sanitizeLibrary(req.body?.entries);
        const merged = mergeLibraries(store.getLibrary(req.userId), incoming);
        await store.setLibrary(req.userId, merged);
        res.json({ entries: merged });
    }),
);

app.get(
    '/api/:mediaType/:id',
    cacheControl(TTL.details),
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            const err = new Error('Invalid id.');
            err.status = 400;
            throw err;
        }
        const { region, language } = localeFrom(req);
        res.json(await tmdb.details(mediaType, id, region || tmdb.DEFAULT_REGION, { language }));
    }),
);

// 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('API error:', err.message);
    res.status(status).json({
        error: err.message || 'Internal server error',
        code: err.code,
    });
});

// Only start listening when run directly — tests import `app` via supertest.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`NEOX API running on port ${PORT}`);
        if (!tmdb.isConfigured()) {
            console.warn('⚠  TMDB_API_KEY is not set — TMDB requests will return 503 until configured.');
        }
        if (auth.usingDefaultSecret) {
            console.warn('⚠  JWT_SECRET is not set — using an insecure default. Set it in production.');
        }
    });
}

module.exports = app;
