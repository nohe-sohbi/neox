import { describe, expect, it, vi } from 'vitest';

const { SingleFlight } = require('./single-flight');

/** A deferred promise we can resolve/reject by hand to control timing. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SingleFlight', () => {
  it('runs the worker once for concurrent callers of the same key', async () => {
    const sf = new SingleFlight();
    const d = deferred();
    const fn = vi.fn(() => d.promise);

    const a = sf.run('k', fn);
    const b = sf.run('k', fn);
    const c = sf.run('k', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sf.stats()).toMatchObject({ inFlight: 1, coalesced: 2, flights: 1 });

    d.resolve('value');
    await expect(Promise.all([a, b, c])).resolves.toEqual(['value', 'value', 'value']);
    expect(sf.stats().inFlight).toBe(0);
  });

  it('shares rejections with all coalesced callers', async () => {
    const sf = new SingleFlight();
    const d = deferred();
    const a = sf.run('k', () => d.promise);
    const b = sf.run('k', () => d.promise);

    const boom = new Error('upstream down');
    d.reject(boom);

    await expect(a).rejects.toBe(boom);
    await expect(b).rejects.toBe(boom);
  });

  it('clears the slot on settle so the next call starts a fresh flight', async () => {
    const sf = new SingleFlight();

    await sf.run('k', () => Promise.resolve(1));
    expect(sf.stats().inFlight).toBe(0);

    const second = vi.fn(() => Promise.resolve(2));
    await expect(sf.run('k', second)).resolves.toBe(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(sf.stats().flights).toBe(2);
    expect(sf.stats().coalesced).toBe(0);
  });

  it('does not coalesce across different keys', async () => {
    const sf = new SingleFlight();
    const da = deferred();
    const db = deferred();
    const a = sf.run('a', () => da.promise);
    const b = sf.run('b', () => db.promise);

    expect(sf.stats()).toMatchObject({ inFlight: 2, coalesced: 0, flights: 2 });

    da.resolve('A');
    db.resolve('B');
    await expect(a).resolves.toBe('A');
    await expect(b).resolves.toBe('B');
  });

  it('recovers if the worker throws synchronously', async () => {
    const sf = new SingleFlight();
    await expect(
      sf.run('k', () => {
        throw new Error('sync boom');
      }),
    ).rejects.toThrow('sync boom');
    // Slot must be cleared even though fn threw before returning a promise.
    expect(sf.stats().inFlight).toBe(0);
  });
});
