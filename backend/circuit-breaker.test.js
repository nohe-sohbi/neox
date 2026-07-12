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

  it('lets only a single probe through in half-open; concurrent callers short-circuit', () => {
    const { breaker, clock } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    clock.t += 1000; // cooldown elapsed → half-open on next touch

    expect(breaker.allow()).toBe(true); // the one probe
    expect(breaker.allow()).toBe(false); // everyone else waits
    expect(breaker.allow()).toBe(false);
    expect(breaker.stats().state).toBe('half-open');
    expect(breaker.stats().shortCircuits).toBe(2);
  });

  it('earns a fresh probe after each cooldown once a probe re-opens the circuit', () => {
    const { breaker, clock } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    clock.t += 1000;
    expect(breaker.allow()).toBe(true); // first probe
    breaker.recordFailure(); // probe fails → re-open
    expect(breaker.allow()).toBe(false); // still cooling down

    clock.t += 1000;
    expect(breaker.allow()).toBe(true); // a brand-new probe is allowed
    expect(breaker.allow()).toBe(false); // still just one
  });

  it('a straggler failure while already open does not extend the cooldown', () => {
    const { breaker, clock } = makeBreaker();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure(); // opens at t=0
    expect(breaker.stats().state).toBe('open');

    clock.t += 500; // half-way through the cooldown
    breaker.recordFailure(); // a late failure from an in-flight request
    expect(breaker.stats().trips).toBe(1); // no new trip while already open

    clock.t += 500; // reaches the *original* openedAt + cooldown
    expect(breaker.stats().state).toBe('half-open'); // window was not pushed forward
  });
});
