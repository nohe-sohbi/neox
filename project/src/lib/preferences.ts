/**
 * User preferences: the small settings that shape the app around you.
 *
 * Streaming platforms, catalogue region/language, and the library's default
 * sort & filter used to live in three separate localStorage keys, which meant a
 * logged-in user still had to reconfigure everything on their next device. They
 * are now one object: stored locally first (so the app keeps working without an
 * account) and synced to the account when there is one.
 *
 * This module is pure and storage-only: no network, no React. It mirrors the
 * backend's `preferences.js` the same way `library-io` mirrors `library.js`,
 * because a value coming back from the server or from another tab is no more
 * trusted than one coming from a file.
 */
import type { LibraryStatus } from './types';
import type { SortMode } from './library-io';

export type LibraryFilter = 'all' | LibraryStatus;

export interface Preferences {
  /** TMDB provider ids powering the "my platforms" filter. */
  platforms: number[];
  /** Catalogue region, ISO 3166-1 alpha-2 (drives availability). */
  region: string;
  /** Catalogue language, e.g. `fr-BE` (also drives the UI language). */
  language: string;
  libraryFilter: LibraryFilter;
  librarySort: SortMode;
  /** Last local change, used to decide which side wins at login. */
  updatedAt: number;
}

const STORAGE_KEY = 'neox.prefs.v1';
// Pre-preferences keys, read once so an existing install keeps its setup.
const LEGACY_PLATFORMS_KEY = 'neox.platforms.v1';
const LEGACY_LOCALE_KEY = 'neox.locale.v1';

const MAX_PLATFORMS = 40;
const LIBRARY_FILTERS: LibraryFilter[] = ['all', 'want', 'watching', 'watched'];
const LIBRARY_SORTS: SortMode[] = [
  'added_desc',
  'added_asc',
  'title_asc',
  'rating_desc',
  'personal_desc',
  'year_desc',
];

const REGION_RE = /^[A-Z]{2}$/;
const LANGUAGE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

export const DEFAULT_PREFERENCES: Preferences = {
  platforms: [],
  region: 'FR',
  language: 'fr-FR',
  libraryFilter: 'all',
  librarySort: 'added_desc',
  updatedAt: 0,
};

function sanitizePlatforms(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids: number[] = [];
  for (const value of raw.slice(0, MAX_PLATFORMS * 4)) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
    if (ids.length === MAX_PLATFORMS) break;
  }
  return ids;
}

/**
 * Folds a partial, untrusted payload onto `base`. An invalid field keeps its
 * previous value rather than snapping back to the default, so one bad key never
 * resets a setting the user chose.
 */
export function sanitizePreferences(raw: unknown, base: Preferences = DEFAULT_PREFERENCES): Preferences {
  const current: Preferences = { ...DEFAULT_PREFERENCES, ...base };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return current;
  const r = raw as Record<string, unknown>;

  const platforms = sanitizePlatforms(r.platforms);
  const region = typeof r.region === 'string' ? r.region.trim().toUpperCase() : null;
  const language = typeof r.language === 'string' ? r.language.trim() : null;
  const updatedAt = Number(r.updatedAt);

  return {
    platforms: platforms ?? current.platforms,
    region: region && REGION_RE.test(region) ? region : current.region,
    language: language && LANGUAGE_RE.test(language) ? language : current.language,
    libraryFilter: LIBRARY_FILTERS.includes(r.libraryFilter as LibraryFilter)
      ? (r.libraryFilter as LibraryFilter)
      : current.libraryFilter,
    librarySort: LIBRARY_SORTS.includes(r.librarySort as SortMode)
      ? (r.librarySort as SortMode)
      : current.librarySort,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : current.updatedAt,
  };
}

/**
 * Which side wins when a device with local preferences meets an account.
 *
 * Same rule as the library's merge: most recently touched wins. An account that
 * never saved preferences (`server === null`) adopts this device's, and a device
 * whose preferences are untouched defaults (`updatedAt === 0`) always yields to
 * the account. Returns the winner plus whether it has to be pushed up.
 */
export function resolvePreferences(
  local: Preferences,
  server: Preferences | null,
): { preferences: Preferences; push: boolean } {
  if (!server) return { preferences: local, push: true };
  if (local.updatedAt > server.updatedAt) return { preferences: local, push: true };
  return { preferences: server, push: false };
}

/** True when two settings point at different catalogue locales. */
export function localeChanged(
  a: { region: string; language: string },
  b: { region: string; language: string },
): boolean {
  return a.region !== b.region || a.language !== b.language;
}

/* ----------------------------- persistence ---------------------------- */

function readLegacy(): Preferences {
  const seeded = { ...DEFAULT_PREFERENCES };
  try {
    const platforms = localStorage.getItem(LEGACY_PLATFORMS_KEY);
    if (platforms) seeded.platforms = sanitizePlatforms(JSON.parse(platforms)) ?? [];
    const locale = localStorage.getItem(LEGACY_LOCALE_KEY);
    if (locale) {
      const parsed = JSON.parse(locale) as Partial<Preferences>;
      return sanitizePreferences({ ...parsed, platforms: seeded.platforms }, DEFAULT_PREFERENCES);
    }
  } catch {
    /* unreadable legacy data is not worth a broken boot */
  }
  return seeded;
}

/** Reads the stored preferences, migrating the pre-preferences keys once. */
export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizePreferences(JSON.parse(raw));
  } catch {
    /* fall through to the legacy read */
  }
  return readLegacy();
}

export function writePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* private mode / quota: the in-memory copy still drives this session */
  }
}
