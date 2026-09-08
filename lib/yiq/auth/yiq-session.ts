import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed session cookie for YIQ access-code logins (students and, later, the
 * quizmaster console operator). These identities do NOT authenticate through
 * Supabase Auth, so this cookie IS the authorization boundary for every
 * self-service write (start attempt, save answer, submit).
 *
 * HMAC-signed and MANDATORY — an unsigned/legacy cookie is rejected outright.
 * Yi-Future shipped an unsigned `yifuture_session` in 2026 and it was a live
 * forgery window (#895); this vertical starts closed.
 */

export type YiqSession =
  | {
      type: "student";
      id: string;
      name: string;
      teamId: string;
      chapterEventId: string;
      category: "junior" | "senior";
    }
  | { type: "quizmaster"; id: string; name: string; chapterEventId: string };

export const YIQ_SESSION_COOKIE = "yiq_session";

export const YIQ_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 12, // 12 hours — one competition sitting.
  // Scoped to /yiq so it cannot leak into /yip, /yi-future, /yifi or /dashboard.
  path: "/yiq",
};

function getSessionSecret(): string {
  return (
    process.env.YIQ_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function hmac(json: string, secret: string): string {
  return createHmac("sha256", secret).update(json).digest("base64url");
}

/** base64url(json) "." base64url(HMAC-SHA256(json, secret)) */
export function signYiqSessionValue(
  payload: YiqSession,
  secret: string = getSessionSecret()
): string {
  if (!secret) throw new Error("No YIQ session signing key configured");
  const json = JSON.stringify(payload);
  return (
    Buffer.from(json, "utf8").toString("base64url") + "." + hmac(json, secret)
  );
}

/** Verify. Returns null on ANY failure — missing, forged, malformed. Fail closed. */
export function verifyYiqSessionValue(
  raw: string | undefined | null,
  secret: string = getSessionSecret()
): YiqSession | null {
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
    if (p?.type === "student" && p.id && p.name && p.teamId && p.chapterEventId) {
      return p as YiqSession;
    }
    if (p?.type === "quizmaster" && p.id && p.name && p.chapterEventId) {
      return p as YiqSession;
    }
    return null;
  } catch {
    return null;
  }
}

export async function mintYiqSession(payload: YiqSession): Promise<void> {
  const store = await cookies();
  store.set(
    YIQ_SESSION_COOKIE,
    signYiqSessionValue(payload),
    YIQ_SESSION_COOKIE_OPTIONS
  );
}

export async function getYiqSession(): Promise<YiqSession | null> {
  const store = await cookies();
  return verifyYiqSessionValue(store.get(YIQ_SESSION_COOKIE)?.value);
}

export async function clearYiqSession(): Promise<void> {
  const store = await cookies();
  store.set(YIQ_SESSION_COOKIE, "", {
    ...YIQ_SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Require the CURRENT student session to own `studentId`. Every attempt write
 * must call this — a client that passes a foreign studentId would otherwise
 * write another student's paper.
 */
export async function requireStudentSession(
  studentId?: string
): Promise<
  | { ok: true; session: Extract<YiqSession, { type: "student" }> }
  | { ok: false; error: string }
> {
  const s = await getYiqSession();
  if (!s || s.type !== "student") {
    return { ok: false, error: "Please sign in with your YIQ access code." };
  }
  if (studentId && s.id !== studentId) {
    return { ok: false, error: "That paper belongs to a different student." };
  }
  return { ok: true, session: s };
}
