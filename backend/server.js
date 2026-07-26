/**
 * NEOX API: a thin, cached proxy in front of TMDB.
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
const { sanitizePreferences } = require('./preferences');
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
// `/api/account` is behind the strict one too: changing a password and deleting
// an account both re-check the current password, so they are guessable surfaces
// exactly like /api/auth/login.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
app.use(['/api/auth', '/api/account'], authLimiter);

// Tiny request logger: quiet but useful in dev.
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

// Auth, account, library and preference responses are per-user and must never
// be cached by anyone.
app.use(['/api/auth', '/api/account', '/api/library', '/api/preferences'], noStore);

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

/* ------------------------------ account ------------------------------- */

const ACCOUNT_NOT_FOUND = { error: 'Compte introuvable.', code: 'AUTH_ACCOUNT_NOT_FOUND' };
const CURRENT_PASSWORD_INVALID = {
    error: 'Mot de passe actuel incorrect.',
    code: 'AUTH_CURRENT_PASSWORD_INVALID',
};

/**
 * Re-checks the password of the authenticated account. A valid token proves the
 * session, not the person holding the device, so both destructive account
 * operations ask again.
 */
async function verifyCurrentPassword(userId, password) {
    const user = store.getUserById(userId);
    if (!user) return { user: null, ok: false };
    const ok = Boolean(password) && (await auth.verifyPassword(String(password), user.passwordHash));
    return { user, ok };
}

app.patch(
    '/api/account/password',
    auth.requireAuth,
    route(async (req, res) => {
        const { currentPassword, newPassword } = req.body || {};
        const invalid = auth.validatePassword(newPassword);
        if (invalid) return res.status(400).json(invalid);

        const { user, ok } = await verifyCurrentPassword(req.userId, currentPassword);
        if (!user) return res.status(404).json(ACCOUNT_NOT_FOUND);
        if (!ok) return res.status(401).json(CURRENT_PASSWORD_INVALID);

        const updated = await store.setPassword(req.userId, await auth.hashPassword(newPassword));
        // The change revoked every token, including the one that made this call:
        // hand back a fresh one so the device that did the right thing is not the
        // one that gets logged out.
        res.json({ token: auth.signToken(updated) });
    }),
);

app.post(
    '/api/account/logout-all',
    auth.requireAuth,
    route(async (req, res) => {
        const updated = await store.revokeSessions(req.userId);
        if (!updated) return res.status(404).json(ACCOUNT_NOT_FOUND);
        res.json({ token: auth.signToken(updated) });
    }),
);

/**
 * Everything the account holds, in one document. `entries` sits at the top level
 * on purpose: the file doubles as a library backup, so a full export can be fed
 * straight back into the app's "Import" without any conversion.
 */
app.get('/api/account/export', auth.requireAuth, (req, res) => {
    const user = store.getUserById(req.userId);
    if (!user) return res.status(404).json(ACCOUNT_NOT_FOUND);
    res.json({
        app: 'neox',
        type: 'account',
        version: 1,
        exportedAt: Date.now(),
        account: store.publicUser(user),
        preferences: store.getPreferences(req.userId),
        entries: store.getLibrary(req.userId),
    });
});

app.delete(
    '/api/account',
    auth.requireAuth,
    route(async (req, res) => {
        const { user, ok } = await verifyCurrentPassword(req.userId, req.body?.password);
        if (!user) return res.status(404).json(ACCOUNT_NOT_FOUND);
        if (!ok) return res.status(401).json(CURRENT_PASSWORD_INVALID);

        await store.deleteUser(req.userId);
        res.status(204).end();
    }),
);

/* ---------------------------- preferences ----------------------------- */

// `null` means "this account has never saved preferences", which the client
// needs in order to tell a fresh account (adopt what is on this device) from a
// deliberate reset (adopt what is on the server).
app.get('/api/preferences', auth.requireAuth, (req, res) => {
    res.json({ preferences: store.getPreferences(req.userId) });
});

app.put(
    '/api/preferences',
    auth.requireAuth,
    route(async (req, res) => {
        const incoming = req.body?.preferences;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
            const err = new Error('Field "preferences" must be an object.');
            err.status = 400;
            err.code = 'PREFERENCES_INVALID_BODY';
            throw err;
        }
        const preferences = sanitizePreferences(incoming, store.getPreferences(req.userId) || undefined);
        await store.setPreferences(req.userId, preferences);
        res.json({ preferences });
    }),
);

/* ------------------------------ library ------------------------------- */

app.get('/api/library', auth.requireAuth, (req, res) => {
    res.json({ entries: store.getLibrary(req.userId), rev: store.getLibraryRev(req.userId) });
});

app.put(
    '/api/library',
    auth.requireAuth,
    route(async (req, res) => {
        // Reject a missing/non-array `entries` outright: treating it as an empty
        // library would silently wipe the account's synced list on a malformed
        // request. An explicit `[]` is still a legitimate "clear".
        if (!Array.isArray(req.body?.entries)) {
            const err = new Error('Field "entries" must be an array.');
            err.status = 400;
            err.code = 'LIBRARY_INVALID_BODY';
            throw err;
        }

        // Optimistic concurrency. A client that sends the revision it last saw is
        // told to re-merge when the server has moved on, instead of overwriting
        // what another device saved in the meantime: a full-replacement PUT is a
        // silent data-loss weapon between two open tabs. Omitting `rev` keeps the
        // old force-replace behaviour, for clients that don't track it.
        const clientRev = req.body.rev;
        const currentRev = store.getLibraryRev(req.userId);
        if (Number.isInteger(clientRev) && clientRev !== currentRev) {
            return res.status(409).json({
                error: 'La bibliothèque a changé sur un autre appareil.',
                code: 'LIBRARY_CONFLICT',
                entries: store.getLibrary(req.userId),
                rev: currentRev,
            });
        }

        const entries = sanitizeLibrary(req.body.entries);
        res.json(await store.setLibrary(req.userId, entries));
    }),
);

app.post(
    '/api/library/merge',
    auth.requireAuth,
    route(async (req, res) => {
        const incoming = sanitizeLibrary(req.body?.entries);
        const merged = mergeLibraries(store.getLibrary(req.userId), incoming);
        res.json(await store.setLibrary(req.userId, merged));
    }),
);

app.get(
    '/api/tv/:id/season/:season',
    cacheControl(TTL.details),
    route(async (req, res) => {
        const id = Number(req.params.id);
        const season = Number(req.params.season);
        // Season 0 (specials) is legitimate, so the floor is 0 here (unlike ids).
        if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(season) || season < 0) {
            const err = new Error('Invalid tv id or season number.');
            err.status = 400;
            throw err;
        }
        res.json(await tmdb.getSeason(id, season, localeFrom(req)));
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

// Only start listening when run directly: tests import `app` via supertest.
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`NEOX API running on port ${PORT}`);
        if (!tmdb.isConfigured()) {
            console.warn('⚠  TMDB_API_KEY is not set: TMDB requests will return 503 until configured.');
        }
        if (auth.usingDefaultSecret) {
            console.warn('⚠  JWT_SECRET is not set: using an insecure default. Set it in production.');
        }
    });

    // Graceful shutdown: on a deploy/restart signal, stop accepting new
    // connections, let in-flight requests finish, snapshot the cache for a warm
    // restart, then exit. A hard timeout guarantees we never hang the
    // orchestrator if a connection refuses to drain.
    let shuttingDown = false;
    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`${signal} received: shutting down gracefully…`);
        const forced = setTimeout(() => {
            console.warn('Shutdown timed out: forcing exit.');
            process.exit(1);
        }, 10000);
        forced.unref();
        server.close(async () => {
            await tmdb.persistCache();
            clearTimeout(forced);
            console.log('Shutdown complete.');
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
