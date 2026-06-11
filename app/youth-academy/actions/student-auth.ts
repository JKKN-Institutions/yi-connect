"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — PUBLIC student authentication (Phase 10).
// Spec: docs/yi-youth-academy-spec.md → "Student session flow".
//
//   loginWithAccessCode — access-code login. Per-IP AND global rate
//       limiting via yuva.login_attempts (rows inserted BEFORE validation;
//       pruned by the drain cron). Generic errors only — the response
//       never reveals whether a code exists.
//   requestOtp — email-OTP request (official lost-code recovery path).
//       Capped per-email + per-IP. Enqueues ONLY when an active enrollment
//       exists for the email, but RESPONDS IDENTICALLY either way
//       (enumeration-proof).
//   verifyOtp — hash/expiry/≤5-attempt check → mint session.
//   signOutStudent — clear the signed cookie.
//
// These are anon-reachable: the service client is safe because every query
// is pinned to caller-supplied-and-validated identifiers (access code /
// email) with explicit status filters — never a broad read.
// ═══════════════════════════════════════════════════════════════════════

import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
} from "@/lib/yuva/cohort";
import { sendYuvaEmail } from "@/lib/yuva/email";
import { otpEmail } from "@/lib/yuva/email-templates";
import {
  decideThrottle,
  retryHint,
  IP_WINDOW_MS,
  type ThrottleAttempt,
} from "@/lib/yuva/login-throttle";
import {
  clearStudentSession,
  mintStudentSession,
} from "@/lib/yuva/auth/student-session";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { verifyTurnstile } from "@/lib/yuva/turnstile";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

// Generic, non-enumerating error copy.
const INVALID_CODE_ERROR =
  "Invalid code. Check the access code from your acceptance email, or use the email option below.";
const INVALID_OTP_ERROR = "Invalid or expired code. Please try again.";
const OTP_NEUTRAL_MESSAGE =
  "If that email has an active enrollment, a code is on its way. Check your inbox (and spam folder).";

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Shared plumbing ───────────────────────────────────────────────────────

/** First hop of x-forwarded-for (donor precedent: actions/apply.ts). */
async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = h.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : "unknown";
}

/**
 * Record one attempt row BEFORE validation (the row IS the throttle state;
 * it counts as a failure until flipped). Returns the row id, or null when
 * even the insert failed — callers FAIL CLOSED on null (an attacker must
 * not get a free, unthrottled validation by breaking the bookkeeping).
 */
async function recordAttempt(svc: Svc, key: string): Promise<string | null> {
  const { data, error } = await svc
    .from("login_attempts")
    .insert({ key, success: false })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[yuva-auth] login_attempts insert failed:", error?.message);
    return null;
  }
  return data.id;
}

/**
 * Load recent attempts for the throttle decision, EXCLUDING the row(s) just
 * inserted for the current request (the caps are about PRIOR attempts).
 * 15 min covers every window (global's 5-min window is a subset). Capped at
 * the most recent 1000 rows — if more exist in-window, the caps are tripped
 * regardless of truncation.
 */
async function loadRecentAttempts(
  svc: Svc,
  excludeIds: string[]
): Promise<ThrottleAttempt[] | null> {
  const cutoff = new Date(Date.now() - IP_WINDOW_MS).toISOString();
  let query = svc
    .from("login_attempts")
    .select("key, attempted_at, success")
    .gte("attempted_at", cutoff)
    .order("attempted_at", { ascending: false })
    .limit(1000);
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[yuva-auth] login_attempts read failed:", error.message);
    return null; // fail closed at the caller
  }
  return data ?? [];
}

function sha256Otp(code: string): string {
  const secret = process.env.YUVA_SESSION_SECRET ?? "";
  return createHash("sha256").update(`${code}${secret}`).digest("hex");
}

// ─── 1. Access-code login ──────────────────────────────────────────────────

export async function loginWithAccessCode(
  code: string
): Promise<ActionResult<{ redirectTo: string }>> {
  // Normalize: uppercase, strip whitespace/dashes (codes are emailed and
  // often re-typed from a phone screen).
  const normalized = (code ?? "").toUpperCase().replace(/[\s-]/g, "");

  const svc = await createServiceClient();
  const ip = await callerIp();
  const ipKey = `ip:${ip}`;

  // Throttle bookkeeping FIRST — even a malformed code burns an attempt.
  const attemptId = await recordAttempt(svc, ipKey);
  if (!attemptId) {
    return { success: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }

  const recent = await loadRecentAttempts(svc, [attemptId]);
  if (!recent) {
    return { success: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }
  const throttle = decideThrottle(recent, new Date(), { ip: ipKey });
  if (!throttle.allowed) {
    return {
      success: false,
      error: `Too many attempts. Please try again in ${retryHint(throttle.retryAfterSeconds)}.`,
    };
  }

  // Shape check before touching the table (cheap reject; same generic error).
  const validShape =
    normalized.length === ACCESS_CODE_LENGTH &&
    [...normalized].every((c) => ACCESS_CODE_ALPHABET.includes(c));

  if (!validShape) {
    return { success: false, error: INVALID_CODE_ERROR };
  }

  const { data: enrollment, error } = await svc
    .from("enrollments")
    .select("id, person_id, run_id, chapter")
    .eq("access_code", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[yuva-auth] enrollment lookup failed:", error.message);
    return { success: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }
  if (!enrollment) {
    // Never reveal whether the code exists / is inactive.
    return { success: false, error: INVALID_CODE_ERROR };
  }

  // Success: flip the attempt row (successes never count against caps).
  await svc
    .from("login_attempts")
    .update({ success: true })
    .eq("id", attemptId);

  await mintStudentSession(enrollment.person_id);

  await logYuvaAudit({
    action: "login",
    entity: "enrollments",
    entity_id: enrollment.id,
    chapter: enrollment.chapter,
    actor_person_id: enrollment.person_id,
    meta: { method: "access_code" },
  });

  return { success: true, data: { redirectTo: "/youth-academy/me" } };
}

// ─── 2. Email OTP — request ────────────────────────────────────────────────

export async function requestOtp(
  email: string,
  turnstileToken?: string | null
): Promise<ActionResult<{ message: string }>> {
  const normalized = (email ?? "").trim().toLowerCase();

  const svc = await createServiceClient();
  const ip = await callerIp();
  const ipKey = `ip:${ip}`;

  if (!EMAIL_RE.test(normalized) || normalized.length > 254) {
    return { success: false, error: "Please enter a valid email address." };
  }

  // Turnstile (abuse hardening). No-op when TURNSTILE_SECRET_KEY is unset —
  // verifyTurnstile returns true, so behaviour is unchanged until keys are
  // added. When enforcing, a missing/invalid token is rejected before any
  // OTP is enqueued. (Anti-enumeration is unaffected: this gate is about the
  // challenge, not whether an enrollment exists.)
  if (!(await verifyTurnstile(turnstileToken ?? null, ip === "unknown" ? undefined : ip))) {
    return {
      success: false,
      error: "Please complete the verification and try again.",
    };
  }

  const emailKey = `email:${normalized}`;

  // Every request burns one row per cap key (request caps, not failure
  // caps — they stay success=false so repeated requests rate-limit).
  const attemptId = await recordAttempt(svc, ipKey);
  const emailAttemptId = await recordAttempt(svc, emailKey);
  if (!attemptId || !emailAttemptId) {
    return { success: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }

  const recent = await loadRecentAttempts(svc, [attemptId, emailAttemptId]);
  if (!recent) {
    return { success: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }

  const throttle = decideThrottle(recent, new Date(), {
    ip: ipKey,
    email: emailKey,
  });
  if (!throttle.allowed) {
    return {
      success: false,
      error: `Too many requests. Please try again in ${retryHint(throttle.retryAfterSeconds)}.`,
    };
  }

  // Active enrollment lookup via the application's email (applications →
  // enrollments by application_id). Students provisioned without an
  // application row use the access-code path.
  const { data: enrollments, error } = await svc
    .from("enrollments")
    .select("id, applications!inner(email)")
    .eq("applications.email", normalized)
    .eq("status", "active")
    .limit(1);

  if (error) {
    console.error("[yuva-auth] otp enrollment lookup failed:", error.message);
    // Neutral response — internal failure must not be distinguishable
    // from "no enrollment" either.
    return { success: true, data: { message: OTP_NEUTRAL_MESSAGE } };
  }

  if (enrollments && enrollments.length > 0) {
    // 6-digit CSPRNG code, hashed at rest (sha256(code + secret)).
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { data: otpRow, error: otpError } = await svc
      .from("login_otps")
      .insert({
        email: normalized,
        code_hash: sha256Otp(code),
        expires_at: new Date(
          Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        ).toISOString(),
      })
      .select("id")
      .single();

    if (!otpError && otpRow) {
      const rendered = otpEmail({ code });
      await sendYuvaEmail({
        to: normalized,
        emailType: "otp",
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        dedupeKey: `otp:${otpRow.id}`,
      });
    } else {
      console.error("[yuva-auth] login_otps insert failed:", otpError?.message);
    }
  }

  // IDENTICAL response whether or not an enrollment exists.
  return { success: true, data: { message: OTP_NEUTRAL_MESSAGE } };
}

// ─── 3. Email OTP — verify ─────────────────────────────────────────────────

export async function verifyOtp(
  email: string,
  code: string
): Promise<ActionResult<{ redirectTo: string }>> {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  const normalizedCode = (code ?? "").replace(/\D/g, "");

  if (!EMAIL_RE.test(normalizedEmail) || normalizedCode.length !== 6) {
    return { success: false, error: INVALID_OTP_ERROR };
  }

  const svc = await createServiceClient();

  // Most recent live (unconsumed, unexpired) OTP for this email.
  const { data: otp, error } = await svc
    .from("login_otps")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("email", normalizedEmail)
    .is("consumed_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[yuva-auth] otp lookup failed:", error.message);
    return { success: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false, error: INVALID_OTP_ERROR };
  }

  if (sha256Otp(normalizedCode) !== otp.code_hash) {
    await svc
      .from("login_otps")
      .update({ attempts: otp.attempts + 1 })
      .eq("id", otp.id);
    return { success: false, error: INVALID_OTP_ERROR };
  }

  // Match — consume the code, then re-resolve the LIVE active enrollment
  // (it may have been dropped between request and verify; fail closed).
  await svc
    .from("login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", otp.id);

  const { data: enrollments, error: enrollError } = await svc
    .from("enrollments")
    .select("id, person_id, chapter, applications!inner(email)")
    .eq("applications.email", normalizedEmail)
    .eq("status", "active")
    .limit(1);

  const enrollment = enrollments?.[0];
  if (enrollError || !enrollment) {
    return { success: false, error: INVALID_OTP_ERROR };
  }

  await mintStudentSession(enrollment.person_id);

  await logYuvaAudit({
    action: "login",
    entity: "enrollments",
    entity_id: enrollment.id,
    chapter: enrollment.chapter,
    actor_person_id: enrollment.person_id,
    meta: { method: "email_otp" },
  });

  return { success: true, data: { redirectTo: "/youth-academy/me" } };
}

// ─── 4. Sign out ───────────────────────────────────────────────────────────

export async function signOutStudent(): Promise<ActionResult> {
  await clearStudentSession();
  return { success: true, data: undefined };
}
