// Yi-Future check-in desk — the retry policy for ONE attendance mark.
//
// Pure, dependency-free and deliberately NOT inside the client component: this
// is the piece whose failure modes cannot be seen on a screenshot (does it
// retry a refusal? does it exceed its own ceiling? does it roll back a write
// that may have landed?), so it lives where it can be exercised directly.
//
// ═══ WHY RETRY ══════════════════════════════════════════════════════════════
// At a busy desk on hotel Wi-Fi it is the REPLY that gets lost, not the write.
// Surfacing that as a warning teaches the volunteer to ignore warnings, and
// then the one that matters is ignored too. So a lost reply is retried quietly
// and only escalates if it still cannot be confirmed.
//
// ═══ WHY REPEATING THE WRITE IS SAFE ════════════════════════════════════════
// markDelegatePresent() is a single upsert on future.phase_event_attendance
// with onConflict "phase_event_id,delegate_id" — that pair is the table's
// COMPOSITE PRIMARY KEY (read off the live schema, not assumed). So:
//   • a repeat can never insert a second row — the PK forbids it;
//   • every column written is an ABSOLUTE value (attended = present,
//     marked_at, marked_by = null, marked_by_volunteer_id), never a delta or a
//     counter, so attempt 2 converges on exactly the state attempt 1 wanted;
//   • the "N of M present" figure is a COUNT of rows, not of taps, so no
//     number can be double-counted.
// The only observable difference between one attempt and three is marked_at
// moving by a second or two.
//
// ═══ WHAT IS AND IS NOT RETRIED ═════════════════════════════════════════════
//   RETRY    a timeout (no reply inside the attempt budget) and a thrown
//            network failure — both mean "we do not know", which is the only
//            state a retry can improve.
//   NEVER    an explicit ok:false from the server. A refusal (no session,
//            revoked code, wrong station, migration not applied) is the same
//            answer however many times it is asked; retrying only delays an
//            honest sentence.
//
// ═══ THE CEILING ════════════════════════════════════════════════════════════
// One deadline covers ALL attempts, not each one, so the volunteer's worst case
// is bounded. Worst case is the sum, and it fits the same 12s watchdog the rest
// of the desk uses:
//       3_500 + 400 + 3_500 + 900 + 3_500 = 11_800ms  ≤  12_000ms
// Each attempt's own timeout is additionally clipped to whatever is left on the
// deadline, so the bound holds however the attempts fall.

export const MARK_ATTEMPTS = 3;
export const MARK_ATTEMPT_TIMEOUT_MS = 3_500;
/** Pause before attempt 2, then before attempt 3. */
export const MARK_BACKOFF_MS = [400, 900];
export const MARK_TOTAL_CEILING_MS = 12_000;
/** Below this much time left, a round trip cannot land — do not start one. */
export const MARK_MIN_ATTEMPT_MS = 800;

export class TimeoutError extends Error {}

/**
 * Reject with TimeoutError after `ms`. The underlying promise is NOT cancelled —
 * a server action that is still running may still write, which is exactly why
 * a timeout is never treated as "did not save".
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * What became of one tap. Four outcomes, not two, because a desk must treat
 * "the server said no" and "the server never answered" as different things:
 *
 *   ok           saved and confirmed.
 *   rejected     the server refused. Print its sentence — it is far more use
 *                than "not confirmed". Roll the tick back UNLESS
 *                `mayHaveLanded`, which is set when an earlier attempt had
 *                already timed out: a refusal arriving after a lost reply (the
 *                chair revoked the code in between, say) does not prove the
 *                first attempt failed to write.
 *   unconfirmed  at least one attempt timed out and none confirmed. The write
 *                may be in the database, so do NOT roll back and do NOT tick.
 *   failed       no attempt got out (network). Safe to roll back.
 */
export type MarkOutcome =
  | { kind: "ok" }
  | { kind: "rejected"; error: string; mayHaveLanded: boolean }
  | { kind: "unconfirmed"; error: string }
  | { kind: "failed"; error: string };

/** The shape of the server action's answer that this policy cares about. */
type MarkReply = { ok: true } | { ok: false; error: string };

/**
 * Run one mark with quiet retries. Never throws — the caller always gets an
 * outcome it can render.
 *
 * @param attemptMark fires one attempt. Called up to MARK_ATTEMPTS times, and
 *   must be safe to repeat (see the idempotency note at the top of this file).
 * @param onRetry fires immediately before attempt 2 and 3, so the row can show
 *   that something is still happening instead of a dead-looking "saving…".
 */
export async function markWithRetry(
  attemptMark: () => Promise<MarkReply>,
  onRetry?: (attempt: number) => void
): Promise<MarkOutcome> {
  const deadline = Date.now() + MARK_TOTAL_CEILING_MS;
  // Once ANY attempt has timed out a write may be sitting in the database, and
  // from then on rolling the tick back is forbidden however the rest go.
  let anyTimedOut = false;

  for (let attempt = 1; attempt <= MARK_ATTEMPTS; attempt++) {
    const budget = Math.min(MARK_ATTEMPT_TIMEOUT_MS, deadline - Date.now());
    if (budget < MARK_MIN_ATTEMPT_MS) break;
    if (attempt > 1) onRetry?.(attempt);

    try {
      const res = await withTimeout(attemptMark(), budget);
      if (res.ok) return { kind: "ok" };
      return { kind: "rejected", error: res.error, mayHaveLanded: anyTimedOut };
    } catch (e) {
      if (e instanceof TimeoutError) anyTimedOut = true;

      const backoff = MARK_BACKOFF_MS[attempt - 1] ?? 0;
      // Gone offline mid-flight: further attempts cannot reach anything, and
      // burning the remaining seconds only makes the volunteer wait.
      const stillOnline =
        typeof navigator === "undefined" || navigator.onLine !== false;
      const roomLeft = deadline - Date.now() > backoff + MARK_MIN_ATTEMPT_MS;
      if (attempt >= MARK_ATTEMPTS || !stillOnline || !roomLeft) break;
      await sleep(backoff);
    }
  }

  return anyTimedOut
    ? {
        kind: "unconfirmed",
        error: `Tried ${MARK_ATTEMPTS} times with no reply — tap Refresh to check if it saved.`,
      }
    : { kind: "failed", error: "Network error — tap the name again to retry." };
}
