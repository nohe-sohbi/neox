/**
 * "Recently viewed" history — the titles whose detail page the user opened.
 *
 * Stored locally (no account needed), newest-first and de-duplicated, so the
 * home page can offer a "pick up where you left off" rail and the ⌘K palette can
 * resurface what you were just looking at. The pure list helper (`addRecent`) is
 * unit-tested; the storage wrappers are thin and fail-safe so a corrupt or
 * blocked store never breaks the UI.
 */
import type { MediaItem } from './types';

const STORAGE_KEY = 'neox.recentlyViewed.v1';
export const MAX_RECENT_VIEWED = 20;

/** Fired on the window whenever the list changes, so views can refresh live. */
export const RECENT_VIEWED_EVENT = 'neox:recently-viewed-changed';

/** Compact record of a viewed title — just enough to render a MediaCard. */
export interface RecentItem {
  id: number;
  mediaType: MediaItem['mediaType'];
  title: string;
  poster: string | null;
  year: string;
  rating: number | null;
}

function keyOf(item: { id: number; mediaType: string }): string {
  return `${item.mediaType}-${item.id}`;
}

/**
 * Returns a new list with `item` promoted to the front, de-duplicated by media
 * key and capped at `max`. Pure — no storage, no side effects.
 */
export function addRecent(
  list: RecentItem[],
  item: RecentItem,
  max = MAX_RECENT_VIEWED,
): RecentItem[] {
  const rest = list.filter((x) => keyOf(x) !== keyOf(item));
  return [item, ...rest].slice(0, max);
}

/** Pads a stored record back into a full MediaItem for grid/row rendering. */
export function toMediaItem(entry: RecentItem): MediaItem {
  return {
    id: entry.id,
    mediaType: entry.mediaType,
    title: entry.title,
    originalTitle: '',
    overview: '',
    poster: entry.poster,
    backdrop: null,
    year: entry.year,
    rating: entry.rating,
    voteCount: 0,
    popularity: 0,
  };
}

export function readRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentItem =>
        x && typeof x.id === 'number' && (x.mediaType === 'movie' || x.mediaType === 'tv'),
    );
  } catch {
    return [];
  }
}

export function rememberViewed(item: RecentItem): RecentItem[] {
  const next = addRecent(readRecent(), item);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep the in-memory result */
  }
  try {
    window.dispatchEvent(new Event(RECENT_VIEWED_EVENT));
  } catch {
    /* no window (SSR/tests) — nothing to notify */
  }
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(RECENT_VIEWED_EVENT));
  } catch {
    /* ignore */
  }
}
