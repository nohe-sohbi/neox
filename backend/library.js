/**
 * Library entry validation + merge logic shared by the sync endpoints.
 * The client is untrusted, so every entry is sanitized to a known shape before
 * it ever touches the store.
 */
const STATUSES = new Set(['want', 'watching', 'watched']);
const MEDIA_TYPES = new Set(['movie', 'tv']);

const keyOf = (entry) => `${entry.mediaType}:${entry.id}`;

// "season:episode" codes ticked as watched. Mirrors the client's validation:
// well-formed codes only, deduplicated, bounded, dropped when empty.
const EPISODE_CODE_RE = /^\d{1,4}:\d{1,4}$/;
const MAX_SEEN_EPISODES = 2000;

function sanitizeSeenEpisodes(raw) {
    if (!Array.isArray(raw)) return undefined;
    const seen = new Set();
    for (const code of raw) {
        if (typeof code === 'string' && EPISODE_CODE_RE.test(code)) seen.add(code);
        if (seen.size >= MAX_SEEN_EPISODES) break;
    }
    return seen.size ? [...seen] : undefined;
}

// A free-text note the user wrote about a title. Bounded so a synced library
// stays a library and not a blog, and dropped when empty so an entry that
// never got a note doesn't carry an empty string forever.
const MAX_NOTE_LENGTH = 1000;

function sanitizeNote(raw) {
    if (typeof raw !== 'string') return undefined;
    const note = raw.slice(0, MAX_NOTE_LENGTH).trim();
    return note || undefined;
}

// Minutes. Captured from the fiche (a film's runtime, a show's episode
// length) to power the watch-time estimate; anything absurd is not a runtime.
function sanitizeRuntime(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(2000, Math.round(n));
}

function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!MEDIA_TYPES.has(raw.mediaType)) return null;

    let personalRating = null;
    if (raw.personalRating != null) {
        const n = Number(raw.personalRating);
        if (Number.isFinite(n)) personalRating = Math.min(10, Math.max(1, Math.round(n)));
    }

    // Episode progress only makes sense on shows.
    const seenEpisodes = raw.mediaType === 'tv' ? sanitizeSeenEpisodes(raw.seenEpisodes) : undefined;
    const note = sanitizeNote(raw.note);
    const runtime = sanitizeRuntime(raw.runtime);

    const now = Date.now();
    return {
        id,
        mediaType: raw.mediaType,
        title: String(raw.title || '').slice(0, 300),
        poster: typeof raw.poster === 'string' ? raw.poster.slice(0, 500) : null,
        year: typeof raw.year === 'string' ? raw.year.slice(0, 4) : '',
        rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
        status: STATUSES.has(raw.status) ? raw.status : 'want',
        personalRating,
        ...(seenEpisodes ? { seenEpisodes } : {}),
        ...(note ? { note } : {}),
        ...(runtime ? { runtime } : {}),
        addedAt: Number.isFinite(Number(raw.addedAt)) ? Number(raw.addedAt) : now,
        updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : now,
    };
}

function sanitizeLibrary(entries) {
    if (!Array.isArray(entries)) return [];
    const byKey = new Map();
    for (const raw of entries.slice(0, 2000)) {
        const entry = sanitizeEntry(raw);
        if (entry) byKey.set(keyOf(entry), entry);
    }
    return [...byKey.values()];
}

/** Union of two libraries; on conflict the most recently updated entry wins. */
function mergeLibraries(a, b) {
    const byKey = new Map();
    for (const entry of [...a, ...b]) {
        const k = keyOf(entry);
        const existing = byKey.get(k);
        if (!existing || entry.updatedAt >= existing.updatedAt) byKey.set(k, entry);
    }
    return [...byKey.values()].sort((x, y) => y.addedAt - x.addedAt);
}

module.exports = { sanitizeLibrary, mergeLibraries };
