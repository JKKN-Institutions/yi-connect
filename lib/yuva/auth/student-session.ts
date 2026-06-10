/**
 * Yi Youth Academy student session — HMAC-SHA256-signed JSON cookie.
 *
 * Students are SUBJECTS, not role-holders: no auth.users row, no OAuth. After
 * acceptance they log in with an access code or email OTP and receive this
 * cookie. Donor: app/yi-future/actions/auth.ts signed-session helpers, with
 * the rollout-era plaintext fallback REMOVED — yuva is a new app with zero
 * legacy cookies, so unsigned values are rejected outright (fail closed).
 *
 * Cookie value format (must stay compatible with parseSessionCookie() in
 * lib/supabase/middleware.ts, which decodes the left-of-"." base64url half
 * and checks `type === 'student'` for /youth-academy/me/*):
 *
 *     base64url(json) "." base64url(HMAC-SHA256(json, YUVA_SESSION_SECRET))
 *
 * Payload is { type:'student', personId, exp } ONLY (exp = epoch ms, ≤24h).
 * Enrollments are resolved LIVE from the DB on every gated student action —
 * NEVER trusted from the cookie — so dropping a student or regenerating their
 * access code takes effect on the next request.
 *
 * Middleware checks cookie PRESENCE + shape only; every server action that
 * serves student data must call getStudentSession() to re-verify the
 * signature (cookie presence alone is never trusted).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  YUVA_SESSION_COOKIE,
  YUVA_SESSION_MAX_AGE_HOURS,
} from "@/lib/yuva/constants";

export type StudentSessionPayload = {
  type: "student";
  personId: string;
  exp: number; // epoch milliseconds; hard ceiling 24h from mint
};

function getSessionSecret(): string {
  return process.env.YUVA_SESSION_SECRET ?? "";
}

function hmacSign(json: string, secret: string): string {
  return createHmac("sha256", secret).update(json).digest("base64url");
}

// ─── Pure sign / verify (tsx-tested; secret injected via parameter) ────────

/** Serialize + sign a student session payload into a cookie value. */
export function signStudentSessionValue(
  payload: StudentSessionPayload,
  secret: string
): string {
  if (!secret) {
    // Never mint an unverifiable session. A throwing mint surfaces the
    // misconfiguration at login time instead of silently logging nobody in.
    throw new Error("YUVA_SESSION_SECRET is not set — cannot mint session");
  }
  const json = JSON.stringify(payload);
  return (
    Buffer.from(json, "utf8").toString("base64url") +
    "." +
    hmacSign(json, secret)
  );
}

/**
 * Verify a cookie value. Returns the payload, or null on ANY failure:
 * missing secret, malformed value, bad base64/JSON, signature mismatch,
 * wrong type, missing personId, or expiry in the past. Fail closed — there
 * is deliberately no error detail on this path (it faces forged input).
 */
export function verifyStudentSessionValue(
  raw: string,
  secret: string,
  nowMs: number = Date.now()
): StudentSessionPayload | null {
  if (!secret || !raw) return null;

  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null; // malformed / unsigned

  const encodedPayload = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSig = hmacSign(json, secret);
    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return null; // forged / corrupted / wrong secret
    }

    const parsed = JSON.parse(json) as Partial<StudentSessionPayload>;
    if (parsed.type !== "student") return null; // cross-role replay guard
    if (typeof parsed.personId !== "string" || parsed.personId.length === 0) {
      return null;
    }
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    if (parsed.exp <= nowMs) return null; // expired

    return { type: "student", personId: parsed.personId, exp: parsed.exp };
  } catch {
    return null; // bad base64 / bad JSON / anything else
  }
}

// ─── Cookie-jar wrappers (server-only; thin shells over the pure pair) ─────

const MAX_AGE_SECONDS = YUVA_SESSION_MAX_AGE_HOURS * 60 * 60;

const COOKIE_OPTIONS = {
  path: "/youth-academy", // path-scoped: no leakage into other verticals
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;

/** Mint + set the signed student session cookie (≤24h). */
export async function mintStudentSession(personId: string): Promise<void> {
  const value = signStudentSessionValue(
    {
      type: "student",
      personId,
      exp: Date.now() + MAX_AGE_SECONDS * 1000,
    },
    getSessionSecret()
  );

  const jar = await cookies();
  jar.set(YUVA_SESSION_COOKIE, value, {
    ...COOKIE_OPTIONS,
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Read + verify the student session from the request cookies.
 * Returns null on ANY failure (no cookie, bad signature, expired, …).
 */
export async function getStudentSession(): Promise<StudentSessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(YUVA_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifyStudentSessionValue(raw, getSessionSecret());
}

/** Clear the student session cookie (sign-out). */
export async function clearStudentSession(): Promise<void> {
  const jar = await cookies();
  // Expire in place with matching path attributes — a bare delete() without
  // the path would not clear a path-scoped cookie in every browser.
  jar.set(YUVA_SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}
