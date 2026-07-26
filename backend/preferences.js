/**
 * User preference validation, shared by the preference endpoints.
 *
 * Preferences are the small settings that used to live only in the browser
 * (streaming platforms, catalogue region/language, library sort & filter). They
 * are what makes an account mean "my NEOX, everywhere" rather than "a backup of
 * my watchlist", so they follow the same rule as the library: the client is
 * untrusted, every field is validated against a known shape, and anything
 * unrecognized is dropped instead of stored.
 *
 * `sanitizePreferences` takes a *partial* payload and folds it onto a base, so a
 * client that only knows about three fields can PUT three fields without wiping
 * the ones a newer version of the app added.
 */
const LIBRARY_FILTERS = new Set(['all', 'want', 'watched']);
const LIBRARY_SORTS = new Set([
    'added_desc',
    'added_asc',
    'title_asc',
    'rating_desc',
    'personal_desc',
    'year_desc',
]);

// A watchlist filter set to "my platforms" is worth syncing, but the list itself
// is bounded: TMDB exposes ~200 providers per region and nobody subscribes to
// forty. The cap keeps a hostile payload from growing the store file.
const MAX_PLATFORMS = 40;

const REGION_RE = /^[A-Z]{2}$/;
const LANGUAGE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

const DEFAULT_PREFERENCES = {
    platforms: [],
    region: 'FR',
    language: 'fr-FR',
    libraryFilter: 'all',
    librarySort: 'added_desc',
    updatedAt: 0,
};

function sanitizePlatforms(raw) {
    if (!Array.isArray(raw)) return null;
    const ids = [];
    for (const value of raw.slice(0, MAX_PLATFORMS * 4)) {
        const id = Number(value);
        if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
        if (ids.length === MAX_PLATFORMS) break;
    }
    return ids;
}

/**
 * Folds a partial, untrusted payload onto `base` (the stored preferences, or the
 * defaults for a fresh account). Invalid fields keep their previous value rather
 * than resetting to the default: a client bug should not silently wipe a setting
 * the user chose.
 */
function sanitizePreferences(raw, base = DEFAULT_PREFERENCES) {
    const current = { ...DEFAULT_PREFERENCES, ...base };
    if (!raw || typeof raw !== 'object') return current;

    const platforms = sanitizePlatforms(raw.platforms);
    const region = typeof raw.region === 'string' ? raw.region.trim().toUpperCase() : null;
    const language = typeof raw.language === 'string' ? raw.language.trim() : null;

    return {
        platforms: platforms ?? current.platforms,
        region: region && REGION_RE.test(region) ? region : current.region,
        language: language && LANGUAGE_RE.test(language) ? language : current.language,
        libraryFilter: LIBRARY_FILTERS.has(raw.libraryFilter) ? raw.libraryFilter : current.libraryFilter,
        librarySort: LIBRARY_SORTS.has(raw.librarySort) ? raw.librarySort : current.librarySort,
        // Server-stamped: a client clock that is wrong (or lying) must not decide
        // which side wins the next sync.
        updatedAt: Date.now(),
    };
}

module.exports = { sanitizePreferences, DEFAULT_PREFERENCES, MAX_PLATFORMS };
