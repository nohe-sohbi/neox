/**
 * Circuit breaker for the TMDB upstream.
 *
 * The cache (TTL+LRU+stale) and single-flight coalescing already cut the number
 * of upstream calls dramatically, and the retry/backoff loop absorbs the odd
 * transient blip. But none of those help when TMDB is *durably* down: every
 * cold key still pays the full retry budget (4 attempts × backoff × 12s
 * timeout) before failing, requests pile up, and we keep hammering an upstream
 * that has nothing to give. That's exactly when a service falls over.
 *
 * A circuit breaker turns that slow, repeated failure into a fast, cheap one.
 * After N consecutive upstream failures it "opens": further calls are rejected
 * immediately (the caller serves slightly-stale cache, or fails fast with 503)
 * instead of waiting on a dead upstream. After a cooldown it goes "half-open"
 * and lets a single probe through; success closes the circuit, failure re-opens
 * it for another cooldown.
 *
 * It only counts *upstream-health* failures (network/timeout/5xx/exhausted
 * retries): deterministic 4xx client errors (a bad id, an unsupported type)
 * say nothing about TMDB's health and must never trip the breaker.
 *
 * Dependency-free and time-injectable, so the state machine is trivial to
 * unit-test without real timers.
 */
class CircuitBreaker {
  /**
   * @param {object} opts
   * @param {number} opts.failureThreshold Consecutive failures before opening.
   * @param {number} opts.cooldownMs       How long to stay open before probing.
   * @param {() => number} opts.now        Clock injection (defaults to Date.now).
   */
  constructor({ failureThreshold = 5, cooldownMs = 30000, now = Date.now } = {}) {
    this.failureThreshold = Math.max(1, failureThreshold);
    this.cooldownMs = Math.max(0, cooldownMs);
    this._now = now;

    this.state = 'closed'; // 'closed' | 'open' | 'half-open'
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    // In half-open, exactly one probe is allowed upstream; concurrent callers are
    // short-circuited until that probe records a success (close) or failure (re-open).
    this.halfOpenProbing = false;

    // Diagnostics surfaced via /api/health.
    this.trips = 0; // closed/half-open -> open transitions
    this.shortCircuits = 0; // calls rejected without touching the upstream
    this.successes = 0;
    this.failures = 0;
  }

  /**
   * Resolve the live state, promoting open -> half-open once the cooldown has
   * elapsed so the next caller becomes the probe. Called by every accessor so
   * state never goes stale between events.
   */
  _refresh() {
    if (this.state === 'open' && this._now() - this.openedAt >= this.cooldownMs) {
      this.state = 'half-open';
      this.halfOpenProbing = false; // a fresh cooldown earns a fresh single probe
    }
    return this.state;
  }

  /**
   * Whether a call should be allowed to reach the upstream right now.
   * Closed and half-open let traffic through (half-open = a single probe);
   * open rejects it and bumps the short-circuit counter.
   */
  allow() {
    const state = this._refresh();
    if (state === 'open') {
      this.shortCircuits += 1;
      return false;
    }
    if (state === 'half-open') {
      // Let a single probe through; reject the rest so a durable outage isn't
      // stampeded by every concurrent caller the moment the cooldown lapses.
      if (this.halfOpenProbing) {
        this.shortCircuits += 1;
        return false;
      }
      this.halfOpenProbing = true;
    }
    return true;
  }

  /** A healthy upstream response: reset the failure streak and close up. */
  recordSuccess() {
    this.successes += 1;
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.halfOpenProbing = false;
  }

  /** An upstream-health failure: count it and trip if we've hit the threshold. */
  recordFailure() {
    this.failures += 1;
    this.consecutiveFailures += 1;
    // A failed probe in half-open immediately re-opens for a fresh cooldown.
    if (this._refresh() === 'half-open' || this.consecutiveFailures >= this.failureThreshold) {
      this._trip();
    }
  }

  _trip() {
    // Only a closed/half-open -> open transition (re)starts the cooldown clock. A
    // straggler failure arriving while already open must not push openedAt forward
    // and extend the open window past the configured cooldown.
    if (this.state !== 'open') {
      this.trips += 1;
      this.state = 'open';
      this.openedAt = this._now();
    }
    this.halfOpenProbing = false;
  }

  stats() {
    return {
      state: this._refresh(),
      consecutiveFailures: this.consecutiveFailures,
      trips: this.trips,
      shortCircuits: this.shortCircuits,
      successes: this.successes,
      failures: this.failures,
    };
  }
}

module.exports = { CircuitBreaker };
