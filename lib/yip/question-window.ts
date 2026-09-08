/**
 * Shared rules for the Question Hour submission window.
 *
 * The window itself lives on the EVENT row — `events.questions_open_at` and
 * `events.questions_close_at`, either of which may be NULL meaning "unbounded
 * on that side". `submitQuestion` enforces it server-side, and the member's
 * Question Hour screen shows it. Those two must never disagree, so the rule
 * lives here once and both read it.
 *
 * Pure module (no "use server"): safe to import from client components.
 */

/** How many questions one member may table for one event. */
export const MAX_QUESTIONS_PER_PARTICIPANT = 3;

/** Minimum length of a question, in characters. */
export const MIN_QUESTION_LENGTH = 20;

export type QuestionWindowState =
  /** Submissions are being accepted right now. */
  | "open"
  /** The window has an open time that has not arrived yet. */
  | "not_yet"
  /** The deadline has passed. */
  | "closed";

/**
 * Where `now` sits relative to the event's submission window.
 *
 * A malformed / unparseable timestamp is treated as absent rather than as a
 * closed window — a typo in one bound must not silently lock every member out.
 */
export function resolveQuestionWindowState(
  openAt: string | null | undefined,
  closeAt: string | null | undefined,
  now: number = Date.now()
): QuestionWindowState {
  if (openAt) {
    const t = new Date(openAt).getTime();
    if (!Number.isNaN(t) && now < t) return "not_yet";
  }
  if (closeAt) {
    const t = new Date(closeAt).getTime();
    if (!Number.isNaN(t) && now > t) return "closed";
  }
  return "open";
}

/**
 * "2 days left" / "4 hours left" / "35 minutes left" — the plain-English time
 * remaining before `closeAt`, or null when there is no deadline (or it has
 * already passed, which the state check handles instead).
 */
export function timeLeftLabel(
  closeAt: string | null | undefined,
  now: number = Date.now()
): string | null {
  if (!closeAt) return null;
  const t = new Date(closeAt).getTime();
  if (Number.isNaN(t)) return null;
  const ms = t - now;
  if (ms <= 0) return null;

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} minute${minutes === 1 ? "" : "s"} left`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} left`;
}
