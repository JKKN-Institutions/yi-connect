/**
 * Yi Youth Academy — login throttle decision (pure engine, zero I/O) [TDD].
 * Tests: lib/yuva/__tests__/login-throttle.test.ts
 * Spec: docs/yi-youth-academy-spec.md "Student session flow" — per-IP AND
 * global rate limiting + lockout backoff; throttle state lives in
 * yuva.login_attempts (rows keyed 'ip:{ip}' / 'email:{email}', pruned by
 * the drain cron).
 *
 * Policy (sliding windows; successes never count):
 *   - per-IP key:    ≥8  failures in 15 min → block (lifts as failures age out)
 *   - per-email key: ≥5  failures in 15 min → block
 *   - global:        ≥100 failures (ANY key) in 5 min → block
 *     (credential-stuffing brake — many IPs hammering many codes at once)
 *
 * decideThrottle is FAIL-CLOSED by construction: callers translate a
 * blocked decision into a generic error + retry hint and never run the
 * credential lookup.
 */

export const IP_WINDOW_MS = 15 * 60 * 1000;
export const IP_MAX_FAILURES = 8;

export const EMAIL_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_MAX_FAILURES = 5;

export const GLOBAL_WINDOW_MS = 5 * 60 * 1000;
export const GLOBAL_MAX_FAILURES = 100;

/** Slice of a yuva.login_attempts row the decision needs. */
export type ThrottleAttempt = {
  key: string;
  /** ISO timestamp (login_attempts.attempted_at). */
  attempted_at: string;
  success: boolean;
};

/** Full key strings as stored in login_attempts ('ip:…', optional 'email:…'). */
export type ThrottleKeys = {
  ip: string;
  email?: string;
};

export type ThrottleDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * When a cap is tripped (n in-window failures ≥ threshold), the block lifts
 * once enough failures age out of the sliding window that the count falls
 * BELOW the threshold — i.e. when the (n − threshold + 1)-th oldest
 * in-window failure exits the window. Returns milliseconds until then,
 * or null when the cap is not tripped.
 */
function tripMs(
  failureTimesMs: number[],
  nowMs: number,
  windowMs: number,
  threshold: number
): number | null {
  const inWindow = failureTimesMs
    .filter((t) => t > nowMs - windowMs)
    .sort((a, b) => a - b);
  if (inWindow.length < threshold) return null;
  const liftsAt = inWindow[inWindow.length - threshold] + windowMs;
  return Math.max(liftsAt - nowMs, 1000); // tripped ⇒ at least 1s
}

/**
 * Pure throttle decision over recent login_attempts rows.
 *
 * @param attempts recent rows (callers load ~the last 15 min; rows outside
 *                 each cap's window are ignored here anyway)
 * @param now      decision time
 * @param keys     full key strings for the caller's IP and (for OTP paths)
 *                 email; the email cap is only consulted when provided
 */
export function decideThrottle(
  attempts: ThrottleAttempt[],
  now: Date | number,
  keys: ThrottleKeys
): ThrottleDecision {
  const nowMs = typeof now === "number" ? now : now.getTime();

  const failures = attempts.filter((a) => !a.success);
  const timesFor = (key: string): number[] =>
    failures
      .filter((a) => a.key === key)
      .map((a) => new Date(a.attempted_at).getTime())
      .filter((t) => Number.isFinite(t));
  const allTimes = failures
    .map((a) => new Date(a.attempted_at).getTime())
    .filter((t) => Number.isFinite(t));

  const trips: number[] = [];

  const ipTrip = tripMs(timesFor(keys.ip), nowMs, IP_WINDOW_MS, IP_MAX_FAILURES);
  if (ipTrip !== null) trips.push(ipTrip);

  if (keys.email) {
    const emailTrip = tripMs(
      timesFor(keys.email),
      nowMs,
      EMAIL_WINDOW_MS,
      EMAIL_MAX_FAILURES
    );
    if (emailTrip !== null) trips.push(emailTrip);
  }

  const globalTrip = tripMs(
    allTimes,
    nowMs,
    GLOBAL_WINDOW_MS,
    GLOBAL_MAX_FAILURES
  );
  if (globalTrip !== null) trips.push(globalTrip);

  if (trips.length === 0) return { allowed: true };

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(Math.max(...trips) / 1000),
  };
}

/** Human retry hint for the generic throttle error ("try again in ~N min"). */
export function retryHint(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
}
