import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  | { type: "participant"; id: string; name: string; eventId: string }
  // Floor voting: YUVA volunteers log in with an access code and act as
  // roving kiosks — `id` is the volunteers.id row for this event.
  | { type: "volunteer"; id: string; name: string; eventId: string };

export const YIP_SESSION_COOKIE = "yip_session";

export const YIP_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24, // 24 hours
  path: "/",
};

/**
 * HMAC signing key. A dedicated YIP_SESSION_SECRET if set, otherwise the
 * always-present service-role key (server-only, high-entropy). The fallback
 * means signing works with ZERO new env config — no missing-secret prod outage
 * — while a dedicated secret can be introduced later for decoupling.
 */
function getSessionSecret(): string {
  return (
    process.env.YIP_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function hmac(json: string, secret: string): string {
  return createHmac("sha256", secret).update(json).digest("base64url");
}

/**
 * Serialize + HMAC-sign a session payload into the cookie value:
 *   base64url(json) "." base64url(HMAC-SHA256(json, secret))
 * Compatible with parseSessionCookie() in lib/supabase/middleware.ts, which
 * coarse-decodes the left half for edge route gating — the authoritative
 * signature verify is verifyYipSessionValue() / getYipSession() below.
 */
export function signYipSessionValue(
  payload: YipSession,
  secret: string = getSessionSecret()
): string {
  if (!secret) throw new Error("No YIP session signing key configured");
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url") + "." + hmac(json, secret);
}

/**
 * Verify a signed cookie value. Returns the payload, or null on ANY failure
 * (missing/forged signature, bad base64/JSON, wrong shape). Fail closed.
 * LEGACY UNSIGNED cookies are REJECTED — signing is mandatory, so a tampered or
 * hand-crafted cookie can no longer impersonate a participant/jury/volunteer.
 */
export function verifyYipSessionValue(
  raw: string | undefined | null,
  secret: string = getSessionSecret()
): YipSession | null {
  if (!raw || !secret) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null; // unsigned / malformed
  const encoded = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const a = Buffer.from(providedSig);
    const b = Buffer.from(hmac(json, secret));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const p = JSON.parse(json);
    if (
      (p?.type === "jury" || p?.type === "participant" || p?.type === "volunteer") &&
      p.id &&
      p.name &&
      p.eventId
    ) {
      return p as YipSession;
    }
    return null;
  } catch {
    return null;
  }
}

/** Mint + set the signed session cookie (next/headers jar). */
export async function mintYipSession(payload: YipSession): Promise<void> {
  const store = await cookies();
  store.set(YIP_SESSION_COOKIE, signYipSessionValue(payload), YIP_SESSION_COOKIE_OPTIONS);
}

export async function getYipSession(): Promise<YipSession | null> {
  const store = await cookies();
  return verifyYipSessionValue(store.get(YIP_SESSION_COOKIE)?.value);
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
 * Require an active volunteer session for `eventId`. Volunteers are kiosk
 * carriers: they may surface the pending-voter list and relay a student's
 * self-cast vote during an OPEN session — nothing else. Returns the volunteer
 * id so capture actions can stamp provenance (recorded_by_volunteer_id).
 */
export async function requireVolunteerSession(
  eventId: string
): Promise<{ ok: true; volunteerId: string; name: string } | { ok: false; error: string }> {
  const s = await getYipSession();
  if (!s || s.type !== "volunteer") return { ok: false, error: "Volunteer session required" };
  if (s.eventId !== eventId) return { ok: false, error: "Session is for a different event" };
  return { ok: true, volunteerId: s.id, name: s.name };
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
