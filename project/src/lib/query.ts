/**
 * Tiny client-side data cache with stale-while-revalidate + in-flight dedup.
 *
 * The backend already caches aggressively (LRU+TTL, HTTP ETags, single-flight),
 * but the SPA still refetched on every navigation: re-mounting Home or Discover
 * threw the previous results away and flashed skeletons. This module keeps
 * successful reads in memory so revisiting a view paints instantly from cache
 * while a background revalidation keeps it fresh, and collapses concurrent reads
 * of the same key into a single network request (client-side single-flight).
 *
 * The cache / freshness / dedup logic is pure (with an injectable `now` clock)
 * so it is unit-tested without a DOM; the React glue lives in `hooks/useQuery`.
 */

export interface CacheEntry<T> {
  data: T;
  storedAt: number;
}

/** Default freshness window for dynamic payloads (home, search…). */
export const DEFAULT_TTL = 5 * 60 * 1000; // 5 min
/** Longer window for near-static reference data (genres, providers…). */
export const STATIC_TTL = 60 * 60 * 1000; // 1 h

/** True while `entry` is still within its TTL relative to `now`. Pure. */
export function isFresh(entry: CacheEntry<unknown>, ttl: number, now: number): boolean {
  return now - entry.storedAt < ttl;
}

export class QueryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.store.get(key) as CacheEntry<T> | undefined;
  }

  /** Cached value if present *and* still fresh, else undefined. */
  getFresh<T>(key: string, ttl: number): T | undefined {
    const entry = this.get<T>(key);
    return entry && isFresh(entry, ttl, this.now()) ? entry.data : undefined;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, storedAt: this.now() });
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  inFlight(key: string): boolean {
    return this.inflight.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  /**
   * Run `fetcher` for `key`, sharing a single in-flight promise across
   * concurrent callers. The result is cached on success; failures are never
   * cached and always free the in-flight slot so a later call can retry.
   */
  fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fetcher()
      .then((data) => {
        this.set(key, data);
        return data;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }
}

/** Shared, app-wide cache instance. */
export const queryCache = new QueryCache();
