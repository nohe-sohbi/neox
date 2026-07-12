/**
 * TMDB client: thin, cached, fault-tolerant wrapper around the TMDB v3 API.
 *
 * - Bounded TTL + LRU cache to stay well under rate limits and keep the UI
 *   snappy, with stale-while-revalidate so a TMDB outage degrades gracefully.
 * - Automatic retry with backoff on 429 / transient network errors.
 * - Normalizes TMDB payloads into the compact shape the frontend consumes,
 *   so the React layer never has to know about TMDB field names.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { TtlLruCache } = require('./cache');
const { SingleFlight } = require('./single-flight');
const { CircuitBreaker } = require('./circuit-breaker');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'w1280';
const PROFILE_SIZE = 'w185';
const LOGO_SIZE = 'w92';
const STILL_SIZE = 'w300';

const API_KEY = process.env.TMDB_API_KEY;
const READ_TOKEN = process.env.TMDB_READ_TOKEN; // optional v4 bearer token
const DEFAULT_REGION = process.env.TMDB_REGION || 'FR';
const DEFAULT_LANGUAGE = process.env.TMDB_LANGUAGE || 'fr-FR';

const CACHE_TTL_MS = 1000 * 60 * 10; // fresh for 10 minutes
const CACHE_STALE_MS = 1000 * 60 * 60; // usable as a fallback for up to 1 hour
const CACHE_MAX_ENTRIES = Number(process.env.TMDB_CACHE_MAX) || 1000;

const cache = new TtlLruCache({
    max: CACHE_MAX_ENTRIES,
    ttlMs: CACHE_TTL_MS,
    staleMs: CACHE_STALE_MS,
});

// Warm-start persistence: on a clean shutdown the cache is snapshotted to disk
// and re-hydrated on boot, so a restart/redeploy doesn't cold-start into a
// thundering herd against TMDB. Best-effort and dependency-free (plain JSON,
// same DATA_DIR as the user store). Set TMDB_CACHE_PERSIST=0 to disable.
const CACHE_PERSIST = process.env.TMDB_CACHE_PERSIST !== '0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CACHE_SNAPSHOT_FILE = path.join(DATA_DIR, 'tmdb-cache.json');

function hydrateCacheFromDisk() {
    if (!CACHE_PERSIST) return 0;
    try {
        if (!fs.existsSync(CACHE_SNAPSHOT_FILE)) return 0;
        const parsed = JSON.parse(fs.readFileSync(CACHE_SNAPSHOT_FILE, 'utf8'));
        return cache.hydrate(parsed.entries);
    } catch (err) {
        console.error('Could not restore TMDB cache snapshot:', err.message);
        return 0;
    }
}

/**
 * Writes the current cache to disk atomically (tmp + rename). Called on a clean
 * shutdown. Never throws — a failed snapshot must not block process exit.
 */
async function persistCache() {
    if (!CACHE_PERSIST) return false;
    try {
        const entries = cache.snapshot();
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
        const tmp = `${CACHE_SNAPSHOT_FILE}.${process.pid}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify({ version: 1, entries }));
        await fs.promises.rename(tmp, CACHE_SNAPSHOT_FILE);
        return true;
    } catch (err) {
        console.error('Could not persist TMDB cache snapshot:', err.message);
        return false;
    }
}

const restored = hydrateCacheFromDisk();
if (restored > 0) console.log(`Restored ${restored} TMDB cache entries from disk.`);

// Collapses concurrent identical cache-misses into a single upstream fetch.
const inflight = new SingleFlight();

// Trips after a streak of upstream failures so a durable TMDB outage fails fast
// (serving stale cache when possible) instead of draining the retry budget on
// every request. Tunable via env for ops.
const breaker = new CircuitBreaker({
    failureThreshold: Number(process.env.TMDB_BREAKER_THRESHOLD) || 5,
    cooldownMs: Number(process.env.TMDB_BREAKER_COOLDOWN_MS) || 30000,
});

function isConfigured() {
    return Boolean(API_KEY || READ_TOKEN);
}

function img(path, size) {
    return path ? `${IMG_BASE}/${size}${path}` : null;
}

/** Cache diagnostics surfaced via /api/health. */
function cacheStats() {
    return { ...cache.stats(), inflight: inflight.stats(), breaker: breaker.stats() };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Low-level TMDB GET with caching + retry.
 * @param {string} path  e.g. "/trending/movie/week"
 * @param {object} params query params
 */
async function tmdbGet(path, params = {}) {
    if (!isConfigured()) {
        const err = new Error('TMDB credentials are not configured on the server.');
        err.status = 503;
        err.code = 'TMDB_NOT_CONFIGURED';
        throw err;
    }

    const query = new URLSearchParams({
        language: DEFAULT_LANGUAGE,
        region: DEFAULT_REGION,
        include_adult: 'false',
        ...params,
    });
    if (API_KEY) query.set('api_key', API_KEY);

    const url = `${TMDB_BASE}${path}?${query.toString()}`;
    const cacheKey = url;

    const cached = cache.get(cacheKey);
    if (cached && !cached.stale) return cached.value;

    // Upstream circuit open (or a half-open probe already in flight): don't pile
    // onto a failing TMDB. Serve slightly-stale cache if we have it, otherwise
    // fail fast with 503. Checked *before* the single-flight so a short-circuited
    // request never counts as an upstream flight in the /api/health metrics.
    if (!breaker.allow()) {
        if (cached) {
            cache.recordStaleServe();
            return cached.value;
        }
        const err = new Error('TMDB upstream temporarily unavailable (circuit open).');
        err.status = 503;
        err.code = 'TMDB_CIRCUIT_OPEN';
        throw err;
    }

    // Coalesce concurrent misses for this exact URL: only the first caller hits
    // TMDB, the rest await the same flight. Keyed by URL so different params
    // (locale, page…) never share a result. No second cache.get() inside: the
    // outer lookup above is authoritative and re-reading would double-count the
    // miss in the /api/health cache metrics.
    return inflight.run(cacheKey, async () => {
        const headers = { accept: 'application/json' };
        if (READ_TOKEN) headers.Authorization = `Bearer ${READ_TOKEN}`;

        const maxAttempts = 4;
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(url, { headers, timeout: 12000 });

                if (response.status === 429) {
                    // Record it so a run that 429s on every attempt reports a real
                    // reason instead of "...: undefined".
                    lastError = new Error('TMDB rate limited (HTTP 429)');
                    const retryAfter = Number(response.headers.get('retry-after')) || attempt;
                    await sleep(retryAfter * 1000);
                    continue;
                }

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    const err = new Error(data.status_message || `TMDB error (HTTP ${response.status})`);
                    err.status = response.status >= 400 && response.status < 500 ? response.status : 502;
                    throw err;
                }

                breaker.recordSuccess();
                cache.set(cacheKey, data);
                return data;
            } catch (error) {
                lastError = error;
                // Deterministic client errors (bad id, unsupported type) say
                // nothing about TMDB's health — but TMDB *did* answer, so the
                // upstream is alive: record a success (which closes a half-open
                // probe) and surface the error without retrying or tripping.
                if (error.status && error.status >= 400 && error.status < 500) {
                    breaker.recordSuccess();
                    throw error;
                }
                if (attempt < maxAttempts) await sleep(2 ** attempt * 250);
            }
        }

        // Every attempt failed on a transient/5xx/timeout error: this counts
        // against upstream health and may trip the breaker for the next caller.
        breaker.recordFailure();

        // Upstream is failing — serve slightly-stale data rather than erroring out.
        if (cached) {
            cache.recordStaleServe();
            return cached.value;
        }

        const err = new Error(`TMDB request failed after ${maxAttempts} attempts: ${lastError?.message}`);
        err.status = 502;
        throw err;
    });
}

/* ----------------------------- normalizers ----------------------------- */

function yearOf(item) {
    const date = item.release_date || item.first_air_date || '';
    return date ? date.slice(0, 4) : '';
}

function normalizeItem(item, mediaTypeHint) {
    const mediaType = item.media_type || mediaTypeHint || 'movie';
    return {
        id: item.id,
        mediaType,
        title: item.title || item.name || 'Sans titre',
        originalTitle: item.original_title || item.original_name || '',
        overview: item.overview || '',
        poster: img(item.poster_path, POSTER_SIZE),
        backdrop: img(item.backdrop_path, BACKDROP_SIZE),
        year: yearOf(item),
        rating: typeof item.vote_average === 'number' ? Math.round(item.vote_average * 10) / 10 : null,
        voteCount: item.vote_count || 0,
        popularity: item.popularity || 0,
    };
}

function normalizeList(payload, mediaTypeHint) {
    const results = (payload.results || [])
        .filter((item) => (item.media_type ? item.media_type !== 'person' : true))
        .filter((item) => item.poster_path || item.backdrop_path)
        .map((item) => normalizeItem(item, mediaTypeHint));
    return {
        page: payload.page || 1,
        totalPages: payload.total_pages || 1,
        totalResults: payload.total_results || results.length,
        results,
    };
}

function pickTrailer(videos) {
    const list = videos?.results || [];
    const score = (v) => {
        let s = 0;
        if (v.site === 'YouTube') s += 4;
        if (v.type === 'Trailer') s += 3;
        if (v.type === 'Teaser') s += 1;
        if (v.official) s += 2;
        return s;
    };
    const best = [...list].sort((a, b) => score(b) - score(a))[0];
    return best && best.site === 'YouTube' ? best.key : null;
}

function normalizeProviders(payload, region) {
    const block = payload?.results?.[region] || payload?.results?.US || null;
    if (!block) return { link: null, flatrate: [], rent: [], buy: [] };
    const map = (arr) =>
        (arr || []).map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logo: img(p.logo_path, LOGO_SIZE),
        }));
    return {
        link: block.link || null,
        flatrate: map(block.flatrate),
        rent: map(block.rent),
        buy: map(block.buy),
    };
}

/**
 * A TV season summary as it appears inside a `/tv/{id}` payload. Only seasons
 * that actually have episodes are kept (TMDB sometimes lists empty upcoming
 * seasons). Specials (season 0) are preserved — the client decides how to
 * order them.
 */
function normalizeSeasons(seasons) {
    return (seasons || [])
        .filter((s) => s && typeof s.season_number === 'number' && (s.episode_count || 0) > 0)
        .map((s) => ({
            seasonNumber: s.season_number,
            name: s.name || '',
            overview: s.overview || '',
            poster: img(s.poster_path, POSTER_SIZE),
            episodeCount: s.episode_count || 0,
            airYear: s.air_date ? s.air_date.slice(0, 4) : '',
        }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function normalizeEpisode(ep) {
    return {
        episodeNumber: ep.episode_number,
        name: ep.name || '',
        overview: ep.overview || '',
        still: img(ep.still_path, STILL_SIZE),
        airDate: ep.air_date || '',
        runtime: ep.runtime || null,
        rating: typeof ep.vote_average === 'number' && ep.vote_average > 0
            ? Math.round(ep.vote_average * 10) / 10
            : null,
        voteCount: ep.vote_count || 0,
    };
}

/** A full season payload (`/tv/{id}/season/{n}`) → compact episode list. */
function normalizeSeason(data, seasonNumber) {
    return {
        seasonNumber: typeof data.season_number === 'number' ? data.season_number : seasonNumber,
        name: data.name || '',
        overview: data.overview || '',
        poster: img(data.poster_path, POSTER_SIZE),
        airDate: data.air_date || '',
        episodes: (data.episodes || []).map(normalizeEpisode),
    };
}

/* ------------------------------- queries ------------------------------- */

/** Builds region/language overrides; only includes keys that were provided. */
function locale(opts = {}) {
    const p = {};
    if (opts.language) p.language = opts.language;
    if (opts.region) p.region = opts.region.toUpperCase();
    return p;
}

async function getGenres(mediaType, opts = {}) {
    const data = await tmdbGet(`/genre/${mediaType}/list`, locale(opts));
    return data.genres || [];
}

async function trending(mediaType, window = 'week', opts = {}) {
    return normalizeList(
        await tmdbGet(`/trending/${mediaType}/${window}`, locale(opts)),
        mediaType,
    );
}

/**
 * Pure builder for TMDB /discover query params. Kept separate from the network
 * call so the filter logic (genre, sort, year, rating, providers) is trivially
 * unit-testable without mocking fetch.
 */
function buildDiscoverParams(
    mediaType,
    { genre, sort = 'popularity.desc', page = 1, providers, region, language, year, minRating } = {},
) {
    const params = {
        sort_by: sort,
        page: String(page),
        // A floor of 50 votes keeps obscure entries out — but a user asking for
        // a minimum rating wants a stricter signal, so raise the floor then.
        'vote_count.gte': minRating ? '200' : '50',
        ...locale({ language }),
    };
    if (genre) params.with_genres = String(genre);

    // Release year: TMDB uses different keys for movies vs. shows.
    const y = Number(year);
    if (Number.isInteger(y) && y >= 1900 && y <= 2100) {
        params[mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = String(y);
    }

    // Minimum TMDB score (0–10, one decimal of granularity is plenty).
    const r = Number(minRating);
    if (Number.isFinite(r) && r > 0 && r <= 10) {
        params['vote_average.gte'] = String(r);
    }

    if (providers && providers.length) {
        // TMDB: "|" = OR (available on ANY of these platforms).
        params.with_watch_providers = providers.join('|');
        params.watch_region = (region || DEFAULT_REGION).toUpperCase();
        params.with_watch_monetization_types = 'flatrate';
    }
    return params;
}

async function discover(mediaType, opts = {}) {
    return normalizeList(
        await tmdbGet(`/discover/${mediaType}`, buildDiscoverParams(mediaType, opts)),
        mediaType,
    );
}

/**
 * Watch providers available in a region, ordered by TMDB display priority.
 * Powers the "only on my platforms" filter.
 */
async function getProviders(mediaType, region = DEFAULT_REGION) {
    const data = await tmdbGet(`/watch/providers/${mediaType}`, { watch_region: region.toUpperCase() });
    const priorityOf = (p) =>
        (p.display_priorities && p.display_priorities[region.toUpperCase()]) ??
        p.display_priority ??
        999;
    return (data.results || [])
        .map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logo: img(p.logo_path, LOGO_SIZE),
            priority: priorityOf(p),
        }))
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 24)
        .map(({ id, name, logo }) => ({ id, name, logo }));
}

async function list(mediaType, kind, page = 1, opts = {}) {
    return normalizeList(
        await tmdbGet(`/${mediaType}/${kind}`, { page: String(page), ...locale(opts) }),
        mediaType,
    );
}

async function search(query, page = 1, opts = {}) {
    if (!query || !query.trim()) return { page: 1, totalPages: 1, totalResults: 0, results: [] };
    return normalizeList(
        await tmdbGet('/search/multi', { query: query.trim(), page: String(page), ...locale(opts) }),
    );
}

async function details(mediaType, id, region = DEFAULT_REGION, opts = {}) {
    const data = await tmdbGet(`/${mediaType}/${id}`, {
        append_to_response: 'videos,credits,recommendations,watch/providers',
        ...locale(opts),
    });

    const base = normalizeItem(data, mediaType);
    const cast = (data.credits?.cast || []).slice(0, 12).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        photo: img(c.profile_path, PROFILE_SIZE),
    }));

    return {
        ...base,
        tagline: data.tagline || '',
        runtime: data.runtime || (data.episode_run_time && data.episode_run_time[0]) || null,
        status: data.status || '',
        genres: (data.genres || []).map((g) => g.name),
        releaseDate: data.release_date || data.first_air_date || '',
        numberOfSeasons: data.number_of_seasons || null,
        numberOfEpisodes: data.number_of_episodes || null,
        // Season index for TV (empty for movies) so the client can offer a
        // per-season episode browser without a second details round trip.
        seasons: mediaType === 'tv' ? normalizeSeasons(data.seasons) : [],
        trailerKey: pickTrailer(data.videos),
        cast,
        providers: normalizeProviders(data['watch/providers'], region),
        recommendations: normalizeList(data.recommendations || {}, mediaType).results.slice(0, 12),
    };
}

/**
 * Episodes of a single TV season. Fetched lazily by the client when a user
 * expands a season, so the (potentially large) episode lists never bloat the
 * initial details payload.
 */
async function getSeason(tvId, seasonNumber, opts = {}) {
    return normalizeSeason(
        await tmdbGet(`/tv/${tvId}/season/${seasonNumber}`, locale(opts)),
        seasonNumber,
    );
}

/**
 * Curated home payload assembled in a single round trip from the client's POV.
 * Each row is fetched in parallel; a failing row degrades gracefully to empty.
 */
async function home(region = DEFAULT_REGION, opts = {}) {
    if (!isConfigured()) {
        const err = new Error('TMDB credentials are not configured on the server.');
        err.status = 503;
        err.code = 'TMDB_NOT_CONFIGURED';
        throw err;
    }

    const loc = { language: opts.language, region };
    const safe = (promise) => promise.catch(() => ({ results: [] }));

    const [trendingAll, nowPlaying, popularMovies, topRatedMovies, trendingTv, popularTv] =
        await Promise.all([
            safe(trending('all', 'week', loc)),
            safe(list('movie', 'now_playing', 1, loc)),
            safe(list('movie', 'popular', 1, loc)),
            safe(list('movie', 'top_rated', 1, loc)),
            safe(trending('tv', 'week', loc)),
            safe(list('tv', 'popular', 1, loc)),
        ]);

    const heroPool = (trendingAll.results || []).filter((m) => m.backdrop && m.overview);
    const hero = heroPool.slice(0, 5);

    // Row labels are localized client-side by id (t('home.row.<id>')), so the
    // payload only carries the id + items — no server-side title.
    const rows = [
        { id: 'now_playing', items: nowPlaying.results },
        { id: 'trending_tv', items: trendingTv.results },
        { id: 'popular_movies', items: popularMovies.results },
        { id: 'top_rated', items: topRatedMovies.results },
        { id: 'popular_tv', items: popularTv.results },
    ].filter((row) => row.items && row.items.length > 0);

    return { hero, rows, region };
}

/**
 * Person profile + best-known filmography (movies & TV), de-duplicated and
 * ranked by popularity. Powers clickable cast → actor pages.
 */
async function getPerson(id, opts = {}) {
    const data = await tmdbGet(`/person/${id}`, {
        append_to_response: 'combined_credits',
        ...locale(opts),
    });

    const seen = new Set();
    const credits = (data.combined_credits?.cast || [])
        .filter((c) => (c.media_type === 'movie' || c.media_type === 'tv') && (c.poster_path || c.backdrop_path))
        .map((c) => ({ ...normalizeItem(c, c.media_type), character: c.character || '' }))
        .filter((c) => {
            const k = `${c.mediaType}:${c.id}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 24);

    return {
        id: data.id,
        name: data.name,
        biography: data.biography || '',
        photo: img(data.profile_path, PROFILE_SIZE),
        knownFor: data.known_for_department || '',
        birthday: data.birthday || null,
        placeOfBirth: data.place_of_birth || '',
        credits,
    };
}

/**
 * "For you" recommendations: fan out across the user's seeds, aggregate the
 * results, and rank by how often + how strongly each title is recommended.
 * Titles already in the seed set are excluded.
 */
async function recommend(seeds = [], opts = {}) {
    const valid = seeds
        .filter(
            (s) =>
                s &&
                typeof s === 'object' &&
                (s.mediaType === 'movie' || s.mediaType === 'tv') &&
                Number(s.id) > 0,
        )
        .slice(0, 12);
    if (valid.length === 0) return { results: [] };

    if (!isConfigured()) {
        const err = new Error('TMDB credentials are not configured on the server.');
        err.status = 503;
        err.code = 'TMDB_NOT_CONFIGURED';
        throw err;
    }

    const seedKeys = new Set(valid.map((s) => `${s.mediaType}:${s.id}`));
    const safe = (promise) => promise.catch(() => ({ results: [] }));

    const lists = await Promise.all(
        valid.map((s) =>
            safe(
                tmdbGet(`/${s.mediaType}/${s.id}/recommendations`, locale(opts)).then((d) =>
                    normalizeList(d, s.mediaType),
                ),
            ),
        ),
    );

    const scored = new Map();
    for (const { results } of lists) {
        for (const item of results || []) {
            const k = `${item.mediaType}:${item.id}`;
            if (seedKeys.has(k)) continue;
            const prev = scored.get(k);
            const weight = 1 + (item.popularity || 0) / 500;
            if (prev) prev.score += weight;
            else scored.set(k, { item, score: weight });
        }
    }

    const results = [...scored.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((s) => s.item);

    return { results };
}

module.exports = {
    isConfigured,
    cacheStats,
    persistCache,
    getGenres,
    getProviders,
    getPerson,
    recommend,
    trending,
    discover,
    buildDiscoverParams,
    list,
    search,
    details,
    getSeason,
    home,
    DEFAULT_REGION,
    // Exported for unit tests (pure, no network).
    normalizeSeasons,
    normalizeSeason,
};
