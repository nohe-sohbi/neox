/**
 * Single-flight request coalescing.
 *
 * The TMDB cache already absorbs repeated reads, but it does nothing for
 * *concurrent* misses: when a cold key is requested by N callers at once (a
 * popular title going viral, a cron warming the cache, a burst of traffic after
 * a deploy), each caller fires its own upstream fetch. That's a thundering herd
 * — N identical round trips that hammer TMDB's rate limit and waste latency.
 *
 * SingleFlight collapses those into one: the first caller for a key runs the
 * work, every concurrent caller for the same key awaits the *same* promise, and
 * the entry is cleared as soon as it settles so the next miss starts fresh.
 *
 * It is intentionally dependency-free and unopinionated about what the work is
 * (it just memoizes an in-flight promise), so it is trivial to unit-test and to
 * drop in front of any async function.
 */
class SingleFlight {
  constructor() {
    /** @type {Map<string, Promise<any>>} */
    this.pending = new Map();
    this.coalesced = 0; // how many calls piggy-backed on an in-flight request
    this.flights = 0; // how many upstream calls actually ran
  }

  /**
   * Run `fn` for `key`, sharing the result with any concurrent caller of the
   * same key. Errors are shared too (and never cached past settlement).
   *
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  run(key, fn) {
    const existing = this.pending.get(key);
    if (existing) {
      this.coalesced += 1;
      return existing;
    }

    this.flights += 1;
    // Start the work, then clear the slot on settle (success *or* failure) so a
    // rejected flight never gets replayed to future callers.
    const promise = (async () => fn())().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /** Diagnostics surfaced via /api/health. */
  stats() {
    return {
      inFlight: this.pending.size,
      coalesced: this.coalesced,
      flights: this.flights,
    };
  }
}

module.exports = { SingleFlight };
