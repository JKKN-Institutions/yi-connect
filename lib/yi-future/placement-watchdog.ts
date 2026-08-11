// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — watchdog for the placement screen's server-action calls.
//
// WHY THIS EXISTS
// A server action that never answers looks exactly like one that is still
// working: the button stays disabled and the reviewer stares at "Sending…"
// forever. That is a bug, not a loading state. Every call from the placement
// screen is wrapped so the UI is ALWAYS released, and so the message the
// reviewer gets tells the truth — a timeout means the write may or may not have
// happened, and the only safe next move is to reload and look.
//
// Shared by the review board (invitations) and the strategy panel (unlocking
// teams, creating teams) so all three failure paths read the same.
// ═══════════════════════════════════════════════════════════════════════

/** Marker thrown by `withWatchdog`; recognised by `describeCallFailure`. */
export const WATCHDOG_MARKER = "__PLACEMENT_WATCHDOG__";

/** Invitation batches run ~5 queries per row, so 50 rows can legitimately take a while. */
export const WATCHDOG_APPROVE_MS = 120_000;

/** Unlocking / creating teams is a handful of queries per team. */
export const WATCHDOG_STEP_MS = 60_000;

/**
 * Reject the WAIT (never the request) if the server has not answered in time.
 *
 * The underlying action keeps running on the server — that is precisely why the
 * message says the write may already have happened rather than "it failed".
 */
export async function withWatchdog<T>(
  work: Promise<T>,
  ms: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bell = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(WATCHDOG_MARKER)), ms);
  });
  try {
    return await Promise.race([work, bell]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Turn any thrown value into a sentence a chapter chair can act on.
 *
 * `whatMayHaveHappened` names the specific write in progress ("invitations may
 * already have been sent", "teams may already have been unlocked") so a timeout
 * never leaves the reviewer guessing what to check.
 */
export function describeCallFailure(
  e: unknown,
  whatMayHaveHappened: string
): string {
  if (e instanceof Error && e.message === WATCHDOG_MARKER) {
    return `No response from the server in time. ${whatMayHaveHappened} — reload this page and check before trying again.`;
  }
  if (e instanceof Error && e.message) {
    return `${e.message} — reload this page and check before trying again.`;
  }
  return `Something went wrong and nothing is confirmed. ${whatMayHaveHappened} — reload this page and check before trying again.`;
}
