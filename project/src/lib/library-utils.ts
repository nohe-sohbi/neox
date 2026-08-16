import type { LibraryEntry, MediaItem } from './types';

type ItemRef = Pick<MediaItem, 'id' | 'mediaType'>;

export const entryKey = (item: ItemRef) => `${item.mediaType}:${item.id}`;

/** Stable key for one episode inside `seenEpisodes`, e.g. "2:5" for S2 E5. */
export const episodeCode = (season: number, episode: number) => `${season}:${episode}`;

const EPISODE_CODE_RE = /^\d{1,4}:\d{1,4}$/;
const MAX_SEEN_EPISODES = 2000;

/**
 * Validates a seen-episodes list from untrusted input (imports, sync): only
 * well-formed codes, deduplicated, bounded. Returns undefined when nothing
 * survives so empty lists never bloat stored entries.
 */
export function sanitizeSeenEpisodes(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  for (const code of raw) {
    if (typeof code === 'string' && EPISODE_CODE_RE.test(code)) seen.add(code);
    if (seen.size >= MAX_SEEN_EPISODES) break;
  }
  return seen.size ? [...seen] : undefined;
}

/** Adds or removes one episode code; returns undefined when the list empties. */
export function toggleEpisodeCode(
  list: string[] | undefined,
  code: string,
): string[] | undefined {
  const set = new Set(list ?? []);
  if (set.has(code)) set.delete(code);
  else set.add(code);
  return set.size ? [...set] : undefined;
}

// Strip diacritics + lowercase, so "amelie" finds « Amélie ».
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Accent- and case-insensitive match for the library search box, over the
 * title *and* the note: once you can write "à revoir avec Paul" on a fiche,
 * that sentence is the thing you'll search for later.
 */
export function matchesQuery(
  entry: Pick<LibraryEntry, 'title'> & Partial<Pick<LibraryEntry, 'note'>>,
  query: string,
): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(entry.title).includes(q) || fold(entry.note ?? '').includes(q);
}

/** Bounds a user-written note the same way the sync endpoint does. */
export const MAX_NOTE_LENGTH = 1000;

export function normalizeNote(raw: string): string | undefined {
  const note = raw.slice(0, MAX_NOTE_LENGTH).trim();
  return note || undefined;
}

/**
 * Creates a fresh library entry from a media item, with optional overrides.
 * A `runtime` on the item (only details payloads carry one) rides along, so a
 * title saved from its fiche knows its own length without a second lookup.
 */
export function toEntry(
  item: MediaItem & { runtime?: number | null },
  patch: Partial<LibraryEntry> = {},
): LibraryEntry {
  const now = Date.now();
  return {
    id: item.id,
    mediaType: item.mediaType,
    title: item.title,
    poster: item.poster,
    year: item.year,
    rating: item.rating,
    status: 'want',
    personalRating: null,
    ...(typeof item.runtime === 'number' && item.runtime > 0 ? { runtime: item.runtime } : {}),
    addedAt: now,
    updatedAt: now,
    ...patch,
  };
}

/** Adds the item if absent, removes it if present. Returns the next list. */
export function toggleEntry(entries: LibraryEntry[], item: MediaItem): LibraryEntry[] {
  const key = entryKey(item);
  return entries.some((e) => entryKey(e) === key)
    ? entries.filter((e) => entryKey(e) !== key)
    : [toEntry(item), ...entries];
}

/** Inserts or patches the matching entry, bumping updatedAt. */
export function upsertEntry(
  entries: LibraryEntry[],
  item: MediaItem & { runtime?: number | null },
  patch: Partial<LibraryEntry>,
): LibraryEntry[] {
  const key = entryKey(item);
  const idx = entries.findIndex((e) => entryKey(e) === key);
  if (idx === -1) return [toEntry(item, { ...patch, updatedAt: Date.now() }), ...entries];
  const next = [...entries];
  next[idx] = { ...next[idx], ...patch, updatedAt: Date.now() };
  return next;
}
