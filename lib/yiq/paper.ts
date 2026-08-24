/**
 * Paper helpers — pure, no I/O.
 *
 * The question order for an attempt is SHUFFLED ONCE at start and stored on
 * the attempt row (`attempts.question_order`). It is never re-derived on
 * render: a student who reloads mid-paper must see the same paper in the same
 * order, and a stored order is also what lets the server grade against
 * exactly what was shown.
 */

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type OptionKey = "a" | "b" | "c" | "d";
export const OPTION_KEYS: OptionKey[] = ["a", "b", "c", "d"];

export type PresentedQuestion = {
  id: string;
  topic: string;
  text: string;
  mediaUrl: string | null;
  options: { key: OptionKey; text: string }[];
};

/**
 * Seconds left on an attempt, from the AUTHORITATIVE server deadline.
 * Never negative. Callers must use this rather than counting down from the
 * paper duration — a reload, a slow network or a paused phone must not hand
 * the student extra time.
 */
export function secondsRemaining(expiresAtIso: string, nowMs = Date.now()): number {
  const ms = Date.parse(expiresAtIso) - nowMs;
  return ms <= 0 ? 0 : Math.floor(ms / 1000);
}

export function isExpired(expiresAtIso: string, nowMs = Date.now()): boolean {
  return Date.parse(expiresAtIso) <= nowMs;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Grace window, in ms, allowed on a WRITE that arrives just after the
 * deadline. Covers ordinary network latency on a school wifi so a student's
 * last honest answer is not lost — but it is small, server-side, and never
 * extends the clock the student sees.
 */
export const LATE_WRITE_GRACE_MS = 5000;
