import type { LibraryEntry, MediaItem } from './types';

type ItemRef = Pick<MediaItem, 'id' | 'mediaType'>;

export const entryKey = (item: ItemRef) => `${item.mediaType}:${item.id}`;

/** Creates a fresh library entry from a media item, with optional overrides. */
export function toEntry(item: MediaItem, patch: Partial<LibraryEntry> = {}): LibraryEntry {
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
  item: MediaItem,
  patch: Partial<LibraryEntry>,
): LibraryEntry[] {
  const key = entryKey(item);
  const idx = entries.findIndex((e) => entryKey(e) === key);
  if (idx === -1) return [toEntry(item, { ...patch, updatedAt: Date.now() }), ...entries];
  const next = [...entries];
  next[idx] = { ...next[idx], ...patch, updatedAt: Date.now() };
  return next;
}
