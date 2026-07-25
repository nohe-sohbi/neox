/**
 * Recent-search history, persisted in localStorage. The pure list helpers
 * (`normalizeQuery`, `addSearch`) are unit-tested; the storage wrappers are thin
 * and fail-safe so a corrupt/blocked store never breaks the UI.
 */
const STORAGE_KEY = 'neox.recentSearches.v1';
export const MAX_RECENT = 6;

/** Collapses whitespace and trims, so "  dune   2 " → "dune 2". */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

/**
 * Returns a new list with `query` promoted to the front, de-duplicated
 * case-insensitively and capped at `max`. Empty queries are ignored.
 */
export function addSearch(list: string[], query: string, max = MAX_RECENT): string[] {
  const q = normalizeQuery(query);
  if (!q) return list;
  const rest = list.filter((item) => item.toLowerCase() !== q.toLowerCase());
  return [q, ...rest].slice(0, max);
}

export function readSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string): string[] {
  const next = addSearch(readSearches(), query);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep the in-memory result */
  }
  return next;
}

export function clearSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
