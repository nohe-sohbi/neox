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
const tmdb = require('./tmdb');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', tmdb: tmdb.isConfigured() ? 'configured' : 'missing-key' });
});

app.get(
    '/api/home',
    route(async (req, res) => {
        const region = (req.query.region || tmdb.DEFAULT_REGION).toString().toUpperCase();
        res.json(await tmdb.home(region));
    }),
);

app.get(
    '/api/search',
    route(async (req, res) => {
        const q = (req.query.q || '').toString();
        const page = Math.max(1, Number(req.query.page) || 1);
        res.json(await tmdb.search(q, page));
    }),
);

app.get(
    '/api/genres/:mediaType',
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        res.json({ genres: await tmdb.getGenres(mediaType) });
    }),
);

app.get(
    '/api/discover/:mediaType',
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        const { genre, sort } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        res.json(
            await tmdb.discover(mediaType, {
                genre: genre ? Number(genre) : undefined,
                sort: sort ? sort.toString() : undefined,
                page,
            }),
        );
    }),
);

app.get(
    '/api/trending/:mediaType',
    route(async (req, res) => {
        const mediaType = ['all', 'movie', 'tv'].includes(req.params.mediaType)
            ? req.params.mediaType
            : 'all';
        const window = req.query.window === 'day' ? 'day' : 'week';
        res.json(await tmdb.trending(mediaType, window));
    }),
);

app.get(
    '/api/:mediaType/:id',
    route(async (req, res) => {
        const mediaType = assertMediaType(req.params.mediaType);
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            const err = new Error('Invalid id.');
            err.status = 400;
            throw err;
        }
        const region = (req.query.region || tmdb.DEFAULT_REGION).toString().toUpperCase();
        res.json(await tmdb.details(mediaType, id, region));
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

app.listen(PORT, () => {
    console.log(`NEOX API running on port ${PORT}`);
    if (!tmdb.isConfigured()) {
        console.warn('⚠  TMDB_API_KEY is not set — API requests will return 503 until configured.');
    }
});
