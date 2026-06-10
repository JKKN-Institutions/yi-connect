/**
 * Login-throttle decision tests (tsx harness) — Phase 10 [TDD].
 * Run: npx tsx lib/yuva/__tests__/login-throttle.test.ts
 *
 * Policy under test (spec: docs/yi-youth-academy-spec.md "Student session
 * flow" — per-IP AND global rate limiting + lockout backoff):
 *   - per-IP key:    ≥8 failures in a sliding 15-min window → block 15 min
 *   - per-email key: ≥5 failures in a sliding 15-min window → block
 *   - global:        ≥100 failures (ANY key) in 5 min → block
 *     (credential-stuffing brake)
 *   - successes never count against any cap
 *   - blocked ⇒ retryAfterSeconds = seconds until the count falls back
 *     below the threshold (sliding window aging out)
 */

import {
  decideThrottle,
  IP_MAX_FAILURES,
  IP_WINDOW_MS,
  EMAIL_MAX_FAILURES,
  GLOBAL_MAX_FAILURES,
  GLOBAL_WINDOW_MS,
  type ThrottleAttempt,
} from "../login-throttle";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function test(name: string, fn: () => void) {
  console.log(`\n▶ ${name}`);
  try {
    fn();
    console.log(`  PASS`);
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

const NOW = new Date("2026-06-10T12:00:00.000Z");
const IP_KEY = "ip:203.0.113.7";
const EMAIL_KEY = "email:student@example.com";

/** Build an attempt row N seconds before NOW. */
function row(key: string, secondsAgo: number, success = false): ThrottleAttempt {
  return {
    key,
    attempted_at: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
    success,
  };
}

function failures(key: string, count: number, secondsAgo: number): ThrottleAttempt[] {
  return Array.from({ length: count }, () => row(key, secondsAgo));
}

// ─── Baseline ──────────────────────────────────────────────────────────────

test("no attempts → allowed", () => {
  const d = decideThrottle([], NOW, { ip: IP_KEY });
  assert(d.allowed === true, "empty history is allowed");
});

test("below every threshold → allowed", () => {
  const attempts = [
    ...failures(IP_KEY, IP_MAX_FAILURES - 1, 60),
    ...failures(EMAIL_KEY, EMAIL_MAX_FAILURES - 1, 60),
  ];
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY, email: EMAIL_KEY });
  assert(d.allowed === true, "7 ip + 4 email failures stay allowed");
});

// ─── Per-IP cap (≥8 failures / 15 min) ─────────────────────────────────────

test("per-IP: 8 failures in window → blocked with retry hint", () => {
  const d = decideThrottle(failures(IP_KEY, IP_MAX_FAILURES, 600), NOW, {
    ip: IP_KEY,
  });
  assert(d.allowed === false, "8 in-window ip failures block");
  if (!d.allowed) {
    assert(
      typeof d.retryAfterSeconds === "number" && d.retryAfterSeconds > 0,
      `retryAfterSeconds is a positive number (got ${d.retryAfterSeconds})`
    );
    // All 8 happened 600s ago; window is 900s → oldest ages out in 300s.
    assert(
      d.retryAfterSeconds === 300,
      `sliding window: retry in 300s (got ${d.retryAfterSeconds})`
    );
  }
});

test("per-IP: window expiry — old failures don't count", () => {
  const attempts = [
    ...failures(IP_KEY, 5, 30), // recent
    ...failures(IP_KEY, 10, IP_WINDOW_MS / 1000 + 60), // aged out
  ];
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY });
  assert(d.allowed === true, "only 5 in-window failures → allowed");
});

test("per-IP: successes don't count against", () => {
  const attempts = [
    ...failures(IP_KEY, IP_MAX_FAILURES - 1, 60),
    row(IP_KEY, 30, true),
    row(IP_KEY, 20, true),
    row(IP_KEY, 10, true),
  ];
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY });
  assert(d.allowed === true, "7 failures + 3 successes stay allowed");
});

test("per-IP: other IPs' failures don't trip this IP", () => {
  const d = decideThrottle(failures("ip:198.51.100.9", 20, 60), NOW, {
    ip: IP_KEY,
  });
  assert(d.allowed === true, "20 failures on another ip key → allowed");
});

// ─── Per-email cap (≥5 failures / 15 min) ──────────────────────────────────

test("per-email: 5 failures → blocked even when IP is clean", () => {
  const d = decideThrottle(failures(EMAIL_KEY, EMAIL_MAX_FAILURES, 120), NOW, {
    ip: IP_KEY,
    email: EMAIL_KEY,
  });
  assert(d.allowed === false, "5 email failures block");
});

test("per-email: cap ignored when no email key is in play", () => {
  const d = decideThrottle(failures(EMAIL_KEY, EMAIL_MAX_FAILURES, 120), NOW, {
    ip: IP_KEY,
  });
  assert(d.allowed === true, "email rows alone never block a code login");
});

// ─── Global brake (≥100 failures / 5 min, any key) ─────────────────────────

test("global: 100 failures across many keys in 5 min → blocked", () => {
  const attempts: ThrottleAttempt[] = [];
  for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) {
    attempts.push(row(`ip:10.0.0.${i % 250}`, 60)); // 100 distinct-ish keys
  }
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY });
  assert(d.allowed === false, "credential-stuffing brake trips");
  if (!d.allowed) {
    // All at 60s ago; 5-min window → oldest ages out in 240s.
    assert(
      d.retryAfterSeconds === 240,
      `global retry in 240s (got ${d.retryAfterSeconds})`
    );
  }
});

test("global: 99 in window + 50 outside the 5-min window → allowed", () => {
  const attempts = [
    ...failures("ip:10.1.1.1", 99, 60),
    ...failures("ip:10.2.2.2", 50, GLOBAL_WINDOW_MS / 1000 + 30),
  ];
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY });
  assert(d.allowed === true, "outside-window failures don't feed the brake");
});

test("global: successes don't feed the brake", () => {
  const attempts: ThrottleAttempt[] = [];
  for (let i = 0; i < GLOBAL_MAX_FAILURES + 20; i++) {
    attempts.push(row(`ip:10.3.${i % 200}.1`, 60, true));
  }
  attempts.push(...failures("ip:10.4.4.4", 10, 60));
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY });
  assert(d.allowed === true, "120 successes + 10 failures stay allowed");
});

// ─── Combined / retry semantics ────────────────────────────────────────────

test("retryAfterSeconds reflects the LONGEST-lived block when multiple trip", () => {
  const attempts = [
    // ip tripped: 8 failures 850s ago → ages out in 900-850 = 50s
    ...failures(IP_KEY, IP_MAX_FAILURES, 850),
    // email tripped: 5 failures 100s ago → ages out in 900-100 = 800s
    ...failures(EMAIL_KEY, EMAIL_MAX_FAILURES, 100),
  ];
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY, email: EMAIL_KEY });
  assert(d.allowed === false, "both caps tripped → blocked");
  if (!d.allowed) {
    assert(
      d.retryAfterSeconds === 800,
      `retry is the max across tripped caps (got ${d.retryAfterSeconds})`
    );
  }
});

test("sliding window: more failures than the threshold extend the block", () => {
  // 10 ip failures: 2 at 800s ago, 8 at 10s ago. Count drops below 8 only
  // when 3 failures age out → the 3rd-oldest (10s ago) ages out in 890s.
  const attempts = [
    ...failures(IP_KEY, 2, 800),
    ...failures(IP_KEY, 8, 10),
  ];
  const d = decideThrottle(attempts, NOW, { ip: IP_KEY });
  assert(d.allowed === false, "10 in-window failures block");
  if (!d.allowed) {
    assert(
      d.retryAfterSeconds === 890,
      `block lifts when count falls BELOW the threshold (got ${d.retryAfterSeconds})`
    );
  }
});

console.log("\n— login-throttle tests done —");
