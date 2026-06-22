import { describe, expect, it } from 'vitest';

const { CircuitBreaker } = require('./circuit-breaker');

/** A breaker with a hand-controlled clock so we can drive the cooldown. */
function makeBreaker(overrides = {}) {
  const clock = { t: 0 };
  const breaker = new CircuitBreaker({
    failureThreshold: 3,
    cooldownMs: 1000,
    now: () => clock.t,
    ...overrides,
  });
  return { breaker, clock };
}

describe('CircuitBreaker', () => {
  it('starts closed and lets calls through', () => {
    const { breaker } = makeBreaker();
    expect(breaker.allow()).toBe(true);
    expect(breaker.stats().state).toBe('closed');
  });

  it('opens after the failure threshold and short-circuits further calls', () => {
    const { breaker } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.stats().state).toBe('closed'); // 2 < 3
    breaker.recordFailure();
    expect(breaker.stats().state).toBe('open');
    expect(breaker.stats().trips).toBe(1);

    expect(breaker.allow()).toBe(false);
    expect(breaker.allow()).toBe(false);
    expect(breaker.stats().shortCircuits).toBe(2);
  });

  it('a success resets the failure streak before it can open', () => {
    const { breaker } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.stats().state).toBe('closed'); // streak never reached 3
    expect(breaker.stats().consecutiveFailures).toBe(2);
  });

  it('goes half-open after the cooldown and lets a single probe through', () => {
    const { breaker, clock } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.allow()).toBe(false);

    clock.t += 1000; // cooldown elapsed
    expect(breaker.stats().state).toBe('half-open');
    expect(breaker.allow()).toBe(true); // probe allowed
  });

  it('closes on a successful probe', () => {
    const { breaker, clock } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    clock.t += 1000;
    breaker.allow(); // becomes half-open
    breaker.recordSuccess();
    expect(breaker.stats().state).toBe('closed');
    expect(breaker.stats().consecutiveFailures).toBe(0);
  });

  it('re-opens immediately if the probe fails (without a new streak)', () => {
    const { breaker, clock } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.stats().trips).toBe(1);

    clock.t += 1000;
    breaker.allow(); // half-open
    breaker.recordFailure(); // probe fails
    expect(breaker.stats().state).toBe('open');
    expect(breaker.stats().trips).toBe(2);
    // Still open right after re-tripping (cooldown restarted).
    expect(breaker.allow()).toBe(false);
  });

  it('tracks success/failure counts for diagnostics', () => {
    const { breaker } = makeBreaker();
    breaker.recordSuccess();
    breaker.recordSuccess();
    breaker.recordFailure();
    const s = breaker.stats();
    expect(s.successes).toBe(2);
    expect(s.failures).toBe(1);
  });
});
