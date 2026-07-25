/**
 * HTTP caching helpers for the read-only TMDB proxy endpoints.
 *
 * The server already keeps an in-memory TTL+LRU cache (see cache.js), but every
 * client still re-downloaded the full JSON on each navigation because no HTTP
 * caching headers were sent. These middlewares let browsers and any shared CDN
 * reuse responses:
 *
 *   - `cacheControl(maxAge)` sets `Cache-Control: public` with `max-age` and a
 *     `stale-while-revalidate` window, so repeat views are instant and a slow
 *     upstream is masked. It only marks successful (2xx) responses as
 *     cacheable; errors are never cached.
 *   - `noStore` opts private endpoints (auth, library, health) out of any cache.
 *
 * Conditional requests (ETag / 304 Not Modified) are handled by Express itself
 * once strong ETags are enabled (`app.set('etag', 'strong')`); combined with the
 * headers below, an unchanged payload costs a single empty 304 round trip.
 */

/**
 * Returns middleware that tags successful JSON responses as publicly cacheable.
 * @param {number} maxAge  Freshness window in seconds (browser cache).
 * @param {object} [opts]
 * @param {number} [opts.staleWhileRevalidate]  Seconds a stale copy may be
 *        served while a fresh one is fetched in the background. Defaults to 2×maxAge.
 * @param {number} [opts.sMaxAge]  Shared-cache (CDN) freshness; defaults to maxAge.
 */
function cacheControl(maxAge, opts = {}) {
    const swr = opts.staleWhileRevalidate ?? maxAge * 2;
    const sMaxAge = opts.sMaxAge ?? maxAge;
    const header = `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;

    return (_req, res, next) => {
        const json = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                res.set('Cache-Control', header);
            } else {
                // Never cache errors (a transient TMDB outage, a 503 for a missing
                // key, a 404 for an unknown title). Be *explicit*: with no header a
                // shared cache may still heuristically cache some statuses (404/410,
                // RFC 7234 §4.2.2), and these routes advertise s-maxage (a CDN).
                res.set('Cache-Control', 'no-store');
            }
            return json(body);
        };
        next();
    };
}

/** Middleware that disables all caching: for per-user / volatile endpoints. */
function noStore(_req, res, next) {
    res.set('Cache-Control', 'no-store');
    next();
}

// Sensible per-resource freshness windows (seconds). Catalog data shifts slowly;
// genre and provider lists are near-static, details change rarely, while the
// home/trending/search surfaces are kept short so "what's hot" stays current.
const TTL = {
    static: 60 * 60 * 24, // genres, providers: a day
    details: 60 * 60, // a title's details, a person's filmography: an hour
    dynamic: 60 * 10, // home, trending, discover, search: ten minutes
};

module.exports = { cacheControl, noStore, TTL };
