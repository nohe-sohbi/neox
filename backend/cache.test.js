import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { TtlLruCache } = require('./cache');

describe('TtlLruCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns fresh values within the TTL', () => {
    const cache = new TtlLruCache({ ttlMs: 1000, staleMs: 5000 });
    cache.set('a', 1);
    const hit = cache.get('a');
    expect(hit).toEqual({ value: 1, stale: false });
    expect(cache.stats().hits).toBe(1);
  });

  it('returns a miss for unknown keys', () => {
    const cache = new TtlLruCache();
    expect(cache.get('nope')).toBeNull();
    expect(cache.stats().misses).toBe(1);
  });

  it('marks entries stale past the TTL but within the stale window', () => {
    const cache = new TtlLruCache({ ttlMs: 1000, staleMs: 5000 });
    cache.set('a', 'v');
    vi.advanceTimersByTime(1500);
    const hit = cache.get('a');
    expect(hit).toEqual({ value: 'v', stale: true });
  });

  it('drops entries past the stale window', () => {
    const cache = new TtlLruCache({ ttlMs: 1000, staleMs: 2000 });
    cache.set('a', 'v');
    vi.advanceTimersByTime(2500);
    expect(cache.get('a')).toBeNull();
  });

  it('evicts least-recently-used entries beyond max', () => {
    const cache = new TtlLruCache({ max: 2, ttlMs: 10000, staleMs: 10000 });
    cache.set('a', 1);
    cache.set('b', 2);
    // Touch 'a' so 'b' becomes the least-recently-used.
    expect(cache.get('a')).toEqual({ value: 1, stale: false });
    cache.set('c', 3); // exceeds max → evicts 'b'
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toEqual({ value: 1, stale: false });
    expect(cache.get('c')).toEqual({ value: 3, stale: false });
    expect(cache.stats().evictions).toBe(1);
  });

  it('tracks stale-serve count and hit rate', () => {
    const cache = new TtlLruCache({ ttlMs: 1000, staleMs: 5000 });
    cache.set('a', 1);
    cache.get('a'); // fresh hit
    cache.recordStaleServe();
    const stats = cache.stats();
    expect(stats.staleServed).toBe(1);
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.size).toBe(1);
  });

  describe('snapshot / hydrate (warm-start persistence)', () => {
    it('round-trips entries and preserves freshness across the restart', () => {
      const a = new TtlLruCache({ ttlMs: 1000, staleMs: 5000 });
      a.set('x', { n: 1 });
      vi.advanceTimersByTime(1500); // 'x' is now stale but still within staleMs
      a.set('y', { n: 2 }); // 'y' is fresh

      const b = new TtlLruCache({ ttlMs: 1000, staleMs: 5000 });
      expect(b.hydrate(a.snapshot())).toBe(2);

      // Fresh/stale state is derived from the original storedAt, not the reload.
      expect(b.get('x')).toEqual({ value: { n: 1 }, stale: true });
      expect(b.get('y')).toEqual({ value: { n: 2 }, stale: false });
    });

    it('omits fully-expired entries from the snapshot', () => {
      const cache = new TtlLruCache({ ttlMs: 1000, staleMs: 2000 });
      cache.set('gone', 1);
      vi.advanceTimersByTime(2500); // past the stale window
      cache.set('kept', 2);
      const snap = cache.snapshot();
      expect(snap.map((e) => e.key)).toEqual(['kept']);
    });

    it('drops entries that fell out of the stale window while persisted', () => {
      const a = new TtlLruCache({ ttlMs: 1000, staleMs: 2000 });
      a.set('a', 1);
      const snap = a.snapshot();
      vi.advanceTimersByTime(3000); // snapshot ages past staleMs before reload

      const b = new TtlLruCache({ ttlMs: 1000, staleMs: 2000 });
      expect(b.hydrate(snap)).toBe(0);
      expect(b.get('a')).toBeNull();
    });

    it('respects the size cap and ignores malformed entries', () => {
      const cache = new TtlLruCache({ max: 2, ttlMs: 10000, staleMs: 10000 });
      const restored = cache.hydrate([
        { key: 'a', value: 1, storedAt: Date.now() },
        { key: 'b', value: 2, storedAt: Date.now() },
        { key: 'c', value: 3, storedAt: Date.now() },
        null,
        { key: 'd' }, // missing value/storedAt → skipped
      ]);
      expect(restored).toBe(3);
      expect(cache.stats().size).toBe(2); // LRU cap enforced
      expect(cache.get('a')).toBeNull(); // oldest evicted
      expect(cache.get('c')).toEqual({ value: 3, stale: false });
    });

    it('is a no-op on non-array input', () => {
      const cache = new TtlLruCache();
      expect(cache.hydrate(undefined)).toBe(0);
      expect(cache.hydrate(null)).toBe(0);
    });
  });
});
