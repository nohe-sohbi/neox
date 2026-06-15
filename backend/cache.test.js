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
});
