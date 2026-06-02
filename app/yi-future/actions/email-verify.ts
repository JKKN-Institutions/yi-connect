"use server";

/**
 * Email OTP verification for Future 6.0 delegates.
 *
 * Flow [PRD §2.2]:
 *   1. After registerDelegate(), wizard calls requestEmailOtp().
 *   2. We generate a 6-digit code, INSERT into future.email_otps with
 *      15-minute expiry, and send via the existing email helper.
 *   3. User submits the code → verifyEmailOtp() looks up the most recent
 *      unconsumed row, checks expiry & attempts (max 5), and on match
 *      stamps future.delegates.email_verified_at.
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { sendEmail } from "@/lib/yi-future/email";
import { readSession } from "./auth";

const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

export type ActionResult =
  | { ok: true; email?: string }
  | { ok: false; error: string };

type DelegateSession = {
  type: string;
  id: string;
  edition_id: string;
  name?: string;
};

async function readDelegateSession(): Promise<DelegateSession | null> {
  // Route through the canonical readSession() so this honours the signed
  // cookie format (and dual-accepts legacy plaintext during rollout).
  const s = await readSession();
  if (!s || s.type !== "delegate" || !s.id) return null;
  return { type: s.type, id: s.id, edition_id: s.edition_id, name: s.name };
}

function generateOtpCode(): string {
  // 6-digit, zero-padded, uniformly distributed.
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

// ─── requestEmailOtp ────────────────────────────────────────────────────────

export async function requestEmailOtp(): Promise<ActionResult> {
  const session = await readDelegateSession();
  if (!session) {
    return { ok: false, error: "Session expired. Please register again." };
  }

  const svc = await createServiceClient();

  const { data: delegate } = await svc
    .schema("future")
    .from("delegates")
    .select("id, email, full_name, email_verified_at")
    .eq("id", session.id)
    .maybeSingle();

  if (!delegate) {
    return { ok: false, error: "Delegate not found." };
  }

  const row = delegate as {
    id: string;
    email: string;
    full_name: string;
    email_verified_at: string | null;
  };

  if (row.email_verified_at) {
    return { ok: true, email: row.email };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await svc
    .schema("future")
    .from("email_otps" as never)
    .insert({
      delegate_id: row.id,
      email: row.email,
      code,
      expires_at: expiresAt,
    } as never);

  if (insertError) {
    return {
      ok: false,
      error:
        insertError instanceof Error
          ? insertError.message
          : "Couldn't issue a verification code. Try again.",
    };
  }

  const sendRes = await sendEmail({
    to: row.email,
    triggerType: "custom",
    subject: "Future 6.0 verification code",
    body: `Your code: ${code}\n\nValid for 15 minutes.`,
    recipientSubjectType: "delegate",
    recipientSubjectId: row.id,
  });

  // Even if Resend isn't wired yet, sendEmail logs to notification_log
  // and returns ok. A hard failure is logged but we still tell the user
  // we sent it — the row exists and they can try again.
  if (!sendRes.ok) {
    return { ok: false, error: sendRes.error ?? "Email send failed." };
  }

  return { ok: true, email: row.email };
}

// ─── verifyEmailOtp ─────────────────────────────────────────────────────────

export async function verifyEmailOtp(
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = (code ?? "").trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return { ok: false, error: "Enter the 6-digit code from your email." };
  }

  const session = await readDelegateSession();
  if (!session) {
    return { ok: false, error: "Session expired. Please register again." };
  }

  const svc = await createServiceClient();

  // Fetch most recent unconsumed OTP for this delegate.
  const { data: otpRow } = await svc
    .schema("future")
    .from("email_otps" as never)
    .select("id, code, expires_at, attempts, consumed_at")
    .eq("delegate_id", session.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: {
        id: string;
        code: string;
        expires_at: string;
        attempts: number;
        consumed_at: string | null;
      } | null;
    };

  if (!otpRow) {
    return {
      ok: false,
      error: "No active code found. Tap Resend to get a new one.",
    };
  }

  if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many attempts. Tap Resend to get a fresh code.",
    };
  }

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      error: "That code expired. Tap Resend to get a new one.",
    };
  }

  const matches = otpRow.code === cleaned;

  if (!matches) {
    await svc
      .schema("future")
      .from("email_otps" as never)
      .update({ attempts: otpRow.attempts + 1 } as never)
      .eq("id", otpRow.id);

    const remaining = OTP_MAX_ATTEMPTS - (otpRow.attempts + 1);
    if (remaining <= 0) {
      return {
        ok: false,
        error: "Too many attempts. Tap Resend to get a fresh code.",
      };
    }
    return {
      ok: false,
      error: `Incorrect code. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`,
    };
  }

  // Match → consume + stamp delegate.
  const nowIso = new Date().toISOString();

  const { error: consumeError } = await svc
    .schema("future")
    .from("email_otps" as never)
    .update({ consumed_at: nowIso } as never)
    .eq("id", otpRow.id);

  if (consumeError) {
    return { ok: false, error: "Couldn't confirm the code. Try again." };
  }

  await svc
    .schema("future")
    .from("delegates")
    .update({ email_verified_at: nowIso } as never)
    .eq("id", session.id);

  return { ok: true };
}

// ─── isEmailVerified ────────────────────────────────────────────────────────

export async function isEmailVerified(): Promise<boolean> {
  const session = await readDelegateSession();
  if (!session) return false;

  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("email_verified_at")
    .eq("id", session.id)
    .maybeSingle();

  if (!data) return false;
  return Boolean((data as { email_verified_at: string | null }).email_verified_at);
}
