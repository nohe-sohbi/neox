import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTL, QueryCache, isFresh } from './query';

describe('isFresh', () => {
  it('is true within the TTL and false past it', () => {
    const entry = { data: 1, storedAt: 1_000 };
    expect(isFresh(entry, 500, 1_400)).toBe(true);
    expect(isFresh(entry, 500, 1_500)).toBe(false);
    expect(isFresh(entry, 500, 1_600)).toBe(false);
  });
});

describe('QueryCache get/set/getFresh', () => {
  it('stores and reads back values with a stamped time', () => {
    let now = 1_000;
    const cache = new QueryCache(() => now);
    cache.set('k', { v: 42 });
    expect(cache.get<{ v: number }>('k')).toEqual({ data: { v: 42 }, storedAt: 1_000 });

    now = 1_000 + DEFAULT_TTL - 1;
    expect(cache.getFresh('k', DEFAULT_TTL)).toEqual({ v: 42 });

    now = 1_000 + DEFAULT_TTL;
    expect(cache.getFresh('k', DEFAULT_TTL)).toBeUndefined(); // expired
  });

  it('clear() wipes everything', () => {
    const cache = new QueryCache();
    cache.set('a', 1);
    cache.clear();
    expect(cache.has('a')).toBe(false);
  });
});

describe('QueryCache.fetch — single-flight dedup', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shares one in-flight promise across concurrent callers', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve('value'), 10)),
    );

    const a = cache.fetch('k', fetcher);
    const b = cache.fetch('k', fetcher);
    expect(a).toBe(b); // same promise handed to both
    expect(cache.inFlight('k')).toBe(true);

    await vi.advanceTimersByTimeAsync(10);
    await expect(a).resolves.toBe('value');
    expect(fetcher).toHaveBeenCalledTimes(1); // only one upstream call
    expect(cache.inFlight('k')).toBe(false);
    expect(cache.getFresh('k', 1_000)).toBe('value'); // cached on success
  });

  it('does not cache failures and frees the slot for a retry', async () => {
    const cache = new QueryCache();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    await expect(cache.fetch('k', fetcher)).rejects.toThrow('boom');
    expect(cache.has('k')).toBe(false);
    expect(cache.inFlight('k')).toBe(false);

    await expect(cache.fetch('k', fetcher)).resolves.toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
