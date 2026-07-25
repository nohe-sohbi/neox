/**
 * Bounded TTL + LRU cache with stale-while-revalidate support.
 *
 * The previous TMDB cache was an unbounded Map that grew forever (a memory leak
 * in any long-running process) and threw away cached data the instant it
 * expired. This adds two things that matter in production:
 *
 *   1. A hard size cap with LRU eviction, so memory stays bounded.
 *   2. A stale window beyond the fresh TTL: when an upstream fetch fails, the
 *      caller can fall back to slightly-stale data instead of erroring out.
 *
 * It is intentionally dependency-free and fully synchronous so it is trivial to
 * reason about and unit-test.
 */
class TtlLruCache {
  /**
   * @param {object} opts
   * @param {number} opts.max     Max entries before LRU eviction kicks in.
   * @param {number} opts.ttlMs   How long an entry is considered fresh.
   * @param {number} opts.staleMs How long past freshness an entry may still be
   *                              served as a fallback (must be >= ttlMs).
   */
  constructor({ max = 500, ttlMs = 1000 * 60 * 10, staleMs = 1000 * 60 * 60 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.staleMs = Math.max(staleMs, ttlMs);
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
    this.staleServed = 0;
    this.evictions = 0;
  }

  /**
   * Look up a key.
   * @returns {null | { value: any, stale: boolean }}
   *   - `null` when absent or fully expired (past the stale window).
   *   - `{ value, stale: false }` for a fresh hit.
   *   - `{ value, stale: true }` for an entry past its TTL but within the stale
   *     window: usable only as a fallback.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }

    const age = Date.now() - entry.storedAt;
    if (age > this.staleMs) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }

    // Mark as most-recently-used without disturbing its stored timestamp.
    this.store.delete(key);
    this.store.set(key, entry);

    if (age > this.ttlMs) {
      this.misses += 1;
      return { value: entry.value, stale: true };
    }

    this.hits += 1;
    return { value: entry.value, stale: false };
  }

  set(key, value) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, storedAt: Date.now() });
    this._evictIfNeeded();
  }

  /** Records that a stale entry was served as a fallback (for metrics). */
  recordStaleServe() {
    this.staleServed += 1;
  }

  _evictIfNeeded() {
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
      this.evictions += 1;
    }
  }

  clear() {
    this.store.clear();
  }

  /**
   * Serializable view of the live entries, newest-inserted last so a later
   * hydrate() replays them in the same LRU order. Fully-expired entries (past
   * the stale window) are dropped: no point persisting dead data.
   */
  snapshot() {
    const now = Date.now();
    const out = [];
    for (const [key, entry] of this.store) {
      if (now - entry.storedAt <= this.staleMs) {
        out.push({ key, value: entry.value, storedAt: entry.storedAt });
      }
    }
    return out;
  }

  /**
   * Loads persisted entries (from snapshot()), preserving each entry's original
   * `storedAt` so TTL/stale semantics survive the restart. Anything already past
   * the stale window is skipped, and LRU eviction still caps the total. Returns
   * the number of entries actually restored.
   */
  hydrate(entries) {
    if (!Array.isArray(entries)) return 0;
    const now = Date.now();
    let restored = 0;
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.key !== 'string' ||
        typeof entry.storedAt !== 'number' ||
        !('value' in entry)
      ) {
        continue;
      }
      if (now - entry.storedAt > this.staleMs) continue;
      if (this.store.has(entry.key)) this.store.delete(entry.key);
      this.store.set(entry.key, { value: entry.value, storedAt: entry.storedAt });
      restored += 1;
    }
    this._evictIfNeeded();
    return restored;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      max: this.max,
      hits: this.hits,
      misses: this.misses,
      staleServed: this.staleServed,
      evictions: this.evictions,
      hitRate: total === 0 ? 0 : Math.round((this.hits / total) * 100) / 100,
    };
  }
}

module.exports = { TtlLruCache };
