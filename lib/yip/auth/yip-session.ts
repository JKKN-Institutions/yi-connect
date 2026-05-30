import "server-only";

import { cookies } from "next/headers";

/**
 * Server-side reader for the `yip_session` cookie used by access-code logins
 * (jury + participants — who do NOT authenticate via Supabase Auth, so
 * getYipEventAccess does not model them). The cookie is a plain JSON blob set
 * by app/yip/actions/auth.ts; `id` is the jury_assignments.id (jury) or
 * participants.id (participant), and `eventId` scopes them to one event.
 *
 * Self-service writes (submitScore, castVote, submitQuestion, raiseMotion,
 * participant feedback) MUST verify the client-supplied id/eventId against this
 * session rather than trusting the client — the underlying yip.* tables have
 * INSERT/UPDATE policies open to `public`, so the server action is the only
 * authorization layer.
 */

export type YipSession =
  | { type: "jury"; id: string; name: string; eventId: string }
  | { type: "participant"; id: string; name: string; eventId: string };

export async function getYipSession(): Promise<YipSession | null> {
  const store = await cookies();
  const raw = store.get("yip_session")?.value;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if ((p?.type === "jury" || p?.type === "participant") && p.id && p.name && p.eventId) {
      return p as YipSession;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Require an active jury session that owns `juryAssignmentId` for `eventId`.
 * Returns an error string when the session is missing or does not match — so
 * a caller cannot write another jury's scores by passing a foreign id.
 */
export async function requireJurySession(
  juryAssignmentId: string,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getYipSession();
  if (!s || s.type !== "jury") return { ok: false, error: "Jury session required" };
  if (s.eventId !== eventId) return { ok: false, error: "Session is for a different event" };
  if (s.id !== juryAssignmentId) return { ok: false, error: "Not authorized for this jury identity" };
  return { ok: true };
}

/**
 * Require an active participant session that owns `participantId` for `eventId`.
 */
export async function requireParticipantSession(
  participantId: string,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getYipSession();
  if (!s || s.type !== "participant") return { ok: false, error: "Participant session required" };
  if (s.eventId !== eventId) return { ok: false, error: "Session is for a different event" };
  if (s.id !== participantId) return { ok: false, error: "Not authorized for this participant identity" };
  return { ok: true };
}
