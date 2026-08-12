/**
 * Library import / export + sorting.
 *
 * The watchlist is the one piece of data users actually create in NEOX, so they
 * should own it: export produces a portable JSON backup, import restores (or
 * migrates) it on any device, and `sortEntries` powers the order controls in the
 * Library view. Imported data is untrusted, so every entry is re-validated to the
 * exact `LibraryEntry` shape before it is allowed back into the app: mirroring
 * the backend's `sanitizeLibrary`.
 */
import type { LibraryEntry, LibraryStatus, MediaType } from './types';
import { entryKey } from './library-utils';

export const EXPORT_VERSION = 1;
const MAX_ENTRIES = 2000;
const STATUSES: LibraryStatus[] = ['want', 'watching', 'watched'];
const MEDIA_TYPES: MediaType[] = ['movie', 'tv'];

export interface LibraryBackup {
  app: 'neox';
  type: 'library';
  version: number;
  exportedAt: number;
  count: number;
  entries: LibraryEntry[];
}

/** Serializes a library into a pretty-printed, versioned backup document. */
export function serializeLibrary(entries: LibraryEntry[]): string {
  const backup: LibraryBackup = {
    app: 'neox',
    type: 'library',
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    count: entries.length,
    entries,
  };
  return JSON.stringify(backup, null, 2);
}

/** Suggested filename for a download, e.g. `neox-library-2026-06-20.json`. */
export function backupFilename(now = new Date()): string {
  return `neox-library-${now.toISOString().slice(0, 10)}.json`;
}

function sanitizeEntry(raw: unknown): LibraryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = Number(r.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!MEDIA_TYPES.includes(r.mediaType as MediaType)) return null;

  let personalRating: number | null = null;
  if (r.personalRating != null) {
    const n = Number(r.personalRating);
    if (Number.isFinite(n)) personalRating = Math.min(10, Math.max(1, Math.round(n)));
  }

  const now = Date.now();
  return {
    id,
    mediaType: r.mediaType as MediaType,
    title: String(r.title ?? '').slice(0, 300),
    poster: typeof r.poster === 'string' ? r.poster.slice(0, 500) : null,
    year: typeof r.year === 'string' ? r.year.slice(0, 4) : '',
    rating: Number.isFinite(Number(r.rating)) ? Number(r.rating) : null,
    status: STATUSES.includes(r.status as LibraryStatus) ? (r.status as LibraryStatus) : 'want',
    personalRating,
    addedAt: Number.isFinite(Number(r.addedAt)) ? Number(r.addedAt) : now,
    updatedAt: Number.isFinite(Number(r.updatedAt)) ? Number(r.updatedAt) : now,
  };
}

/**
 * Parses and validates a backup document (or a bare entry array). Throws a
 * plain `Error` with a stable `code` when the payload is unusable so the caller
 * can show a friendly message.
 */
export function parseLibrary(json: string): LibraryEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { code: 'invalid_json' });
  }

  const rawEntries = Array.isArray(data)
    ? data
    : Array.isArray((data as LibraryBackup)?.entries)
      ? (data as LibraryBackup).entries
      : null;

  if (!rawEntries) {
    throw Object.assign(new Error('Not a NEOX library backup'), { code: 'invalid_shape' });
  }

  const byKey = new Map<string, LibraryEntry>();
  for (const raw of rawEntries.slice(0, MAX_ENTRIES)) {
    const entry = sanitizeEntry(raw);
    if (entry) byKey.set(entryKey(entry), entry);
  }

  if (byKey.size === 0) {
    throw Object.assign(new Error('No valid entries'), { code: 'empty' });
  }
  return [...byKey.values()];
}

/**
 * Unions an incoming library into the current one; on key conflict the most
 * recently updated entry wins. Mirrors the backend's `mergeLibraries`.
 */
export function mergeEntries(current: LibraryEntry[], incoming: LibraryEntry[]): LibraryEntry[] {
  const byKey = new Map<string, LibraryEntry>();
  for (const entry of [...current, ...incoming]) {
    const k = entryKey(entry);
    const existing = byKey.get(k);
    if (!existing || entry.updatedAt >= existing.updatedAt) byKey.set(k, entry);
  }
  return [...byKey.values()];
}

export type SortMode = 'added_desc' | 'added_asc' | 'title_asc' | 'rating_desc' | 'personal_desc' | 'year_desc';

export const SORT_MODES: { id: SortMode; key: string }[] = [
  { id: 'added_desc', key: 'sortlib.added_desc' },
  { id: 'added_asc', key: 'sortlib.added_asc' },
  { id: 'title_asc', key: 'sortlib.title_asc' },
  { id: 'rating_desc', key: 'sortlib.rating_desc' },
  { id: 'personal_desc', key: 'sortlib.personal_desc' },
  { id: 'year_desc', key: 'sortlib.year_desc' },
];

const num = (v: number | null | undefined) => (typeof v === 'number' ? v : -Infinity);

/** Returns a new, sorted copy of the entries for the given mode. */
export function sortEntries(entries: LibraryEntry[], mode: SortMode): LibraryEntry[] {
  const copy = [...entries];
  switch (mode) {
    case 'added_asc':
      return copy.sort((a, b) => a.addedAt - b.addedAt);
    case 'title_asc':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'rating_desc':
      return copy.sort((a, b) => num(b.rating) - num(a.rating));
    case 'personal_desc':
      return copy.sort((a, b) => num(b.personalRating) - num(a.personalRating));
    case 'year_desc':
      return copy.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
    case 'added_desc':
    default:
      return copy.sort((a, b) => b.addedAt - a.addedAt);
  }
}
