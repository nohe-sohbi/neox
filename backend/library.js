/**
 * Library entry validation + merge logic shared by the sync endpoints.
 * The client is untrusted, so every entry is sanitized to a known shape before
 * it ever touches the store.
 */
const STATUSES = new Set(['want', 'watching', 'watched']);
const MEDIA_TYPES = new Set(['movie', 'tv']);

const keyOf = (entry) => `${entry.mediaType}:${entry.id}`;

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
