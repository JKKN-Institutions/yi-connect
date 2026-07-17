"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/yi-future/constants";
import { sendEmail } from "@/lib/yi-future/email";
import {
  sendBrandedPasswordReset,
  appBaseUrl,
} from "@/lib/auth/branded-password-reset";

// ─── SHARED ─────────────────────────────────────────────────────────
type AccessCodeRole = "delegate" | "mentor" | "jury" | "partner" | "expert";

type SessionPayload = {
  type: AccessCodeRole;
  id: string;
  edition_id: string;
  name?: string;
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
}

// ─── LOGIN ADMIN (Supabase Auth) ────────────────────────────────────
export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginAdmin(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/yi-future/login");
}

// ─── FORGOT PASSWORD (admin accounts — branded Yi Future email) ─────
// Yi Future admins sign in with Supabase Auth (email + password); delegates use
// access codes and never hit this. We mint a recovery token and send a Yi YUVA
// Future 6.0–branded email instead of Supabase's generic platform template.
export async function requestAdminPasswordReset(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  return sendBrandedPasswordReset(email, {
    appName: "Yi YUVA Future 6.0",
    tagline: "From Opinions to Impact",
    fromEmail:
      process.env.YI_FUTURE_FROM_EMAIL ||
      "Yi YUVA Future 6.0 <noreply@jkkn.ai>",
    headerColor: "#1a1a3e",
    accentColor: "#F5A623",
    baseUrl: appBaseUrl(),
    resetPath: "/yi-future/access/reset-password",
  });
}

// ─── VALIDATE ACCESS CODE (delegate/mentor/jury/partner) ────────────
export type AccessCodeResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

export async function validateAccessCode(
  codeRaw: string
): Promise<AccessCodeResult> {
  const code = normalizeCode(codeRaw);
  if (code.length !== 6) {
    return { ok: false, error: "Access code must be 6 characters." };
  }

  const svc = await createServiceClient();

  // 1. Delegate
  const { data: delegate } = (await svc
    .schema("future")
    .from("delegates")
    .select("id, edition_id, full_name, is_active, registered_at")
    .eq("access_code", code)
    .maybeSingle()) as unknown as {
    data: {
      id: string;
      edition_id: string;
      full_name: string | null;
      is_active: boolean | null;
      registered_at: string | null;
    } | null;
  };
  if (delegate && delegate.is_active !== false) {
    await writeSession({
      type: "delegate",
      id: delegate.id,
      edition_id: delegate.edition_id,
      name: delegate.full_name ?? undefined,
    });
    const firstUnlock = !delegate.registered_at;
    if (firstUnlock) {
      // Mark registered_at on first-ever code unlock
      await svc
        .schema("future")
        .from("delegates")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ registered_at: new Date().toISOString() } as never)
        .eq("id", delegate.id);
    }
    return {
      ok: true,
      redirect: firstUnlock ? "/yi-future/join?just_joined=1" : "/yi-future/me",
    };
  }

  // 2. Mentor
  const { data: mentor } = await svc
    .schema("future")
    .from("mentors")
    .select("id, edition_id, full_name, is_active")
    .eq("access_code", code)
    .maybeSingle();
  if (mentor && mentor.is_active !== false) {
    await writeSession({
      type: "mentor",
      id: mentor.id,
      edition_id: mentor.edition_id,
      name: mentor.full_name ?? undefined,
    });
    return { ok: true, redirect: "/yi-future/mentor" };
  }

  // 3. Jury
  const { data: jury } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("id, edition_id, jury_name, is_active")
    .eq("access_code", code)
    .maybeSingle();
  if (jury && jury.is_active !== false) {
    await writeSession({
      type: "jury",
      id: jury.id,
      edition_id: jury.edition_id,
      name: jury.jury_name ?? undefined,
    });
    return { ok: true, redirect: "/yi-future/jury" };
  }

  // 4. Corporate Partner — edition_id derived via event_id → events → edition_id
  const { data: partner } = await svc
    .schema("future")
    .from("corporate_partners")
    .select("id, event_id, organization, events!inner(edition_id)")
    .eq("access_code", code)
    .maybeSingle();
  if (partner) {
    const eventRef = (partner as unknown as {
      events: { edition_id: string };
    }).events;
    await writeSession({
      type: "partner",
      id: partner.id,
      edition_id: eventRef.edition_id,
      name: partner.organization ?? undefined,
    });
    return { ok: true, redirect: "/yi-future/partner" };
  }

  // 5. Expert — access_code / is_active are new columns not in generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expert } = await (svc as any)
    .schema("future")
    .from("experts")
    .select("id, edition_id, full_name, is_active")
    .eq("access_code", code)
    .maybeSingle();
  if (expert && expert.is_active !== false) {
    await writeSession({
      type: "expert",
      id: expert.id,
      edition_id: expert.edition_id,
      name: expert.full_name ?? undefined,
    });
    return { ok: true, redirect: "/yi-future/expert" };
  }

  return {
    ok: false,
    error: "That code was not recognized. Check the letters and try again.",
  };
}

// ─── EMAIL ME MY CODE (delegate lost access code — BUG-477) ─────────
// Unauthenticated by nature, so it must never reveal whether an email is
// registered: the response is ALWAYS the same neutral message, and all real
// work (lookup, rate limit, send) runs in after() so response timing does not
// diverge between hit and miss. Rate limit: max 3 code emails per address per
// hour, enforced server-side by counting future.notification_log rows.
export async function requestAccessCodeEmail(
  emailRaw: string
): Promise<{ ok: true; message: string }> {
  const NEUTRAL =
    "If that email is registered, we've sent the access code to it.";
  const email = emailRaw?.trim().toLowerCase() ?? "";

  // Shape check only — reveals nothing about registration.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    after(async () => {
      try {
        const svc = await createServiceClient();

        // Server-side rate limit: 3 sends / address / hour.
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count } = await svc
          .schema("future")
          .from("notification_log" as never)
          .select("id", { count: "exact", head: true })
          .eq("recipient_email", email)
          .eq("recipient_subject_type", "access_code_recovery")
          .gte("created_at", oneHourAgo);
        if ((count ?? 0) >= 3) return;

        const { data: delegate } = (await svc
          .schema("future")
          .from("delegates")
          .select("id, full_name, access_code")
          .eq("email", email)
          .eq("is_active", true)
          .order("registered_at", { ascending: false })
          .limit(1)
          .maybeSingle()) as unknown as {
          data: { id: string; full_name: string | null; access_code: string | null } | null;
        };
        if (!delegate?.access_code) return;

        await sendEmail({
          to: email,
          triggerType: "custom",
          recipientSubjectType: "access_code_recovery",
          recipientSubjectId: delegate.id,
          subject: "Your Future 6.0 access code",
          body: `Hi ${delegate.full_name ?? "there"},

Your Future 6.0 access code is: **${delegate.access_code}**

Sign in any time at ${appBaseUrl()}/yi-future/access

If you didn't request this email, you can safely ignore it.`,
        });
      } catch (e) {
        console.warn(
          "[access-code-email] failed:",
          e instanceof Error ? e.message : String(e)
        );
      }
    });
  }

  return { ok: true, message: NEUTRAL };
}

// ─── LOGIN DELEGATE BY EMAIL (for Google OAuth / email-password) ────
export async function loginDelegateByEmail(
  email: string
): Promise<AccessCodeResult> {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) return { ok: false, error: "Email is required." };

  const svc = await createServiceClient();

  const { data: delegate } = (await svc
    .schema("future")
    .from("delegates")
    .select("id, edition_id, full_name, is_active")
    .eq("email", cleanEmail)
    .eq("is_active", true)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as unknown as {
    data: {
      id: string;
      edition_id: string;
      full_name: string | null;
      is_active: boolean | null;
    } | null;
  };

  if (!delegate) {
    return {
      ok: false,
      error: "No delegate found with that email. Register first at /yi-future/join.",
    };
  }

  await writeSession({
    type: "delegate",
    id: delegate.id,
    edition_id: delegate.edition_id,
    name: delegate.full_name ?? undefined,
  });

  return { ok: true, redirect: "/yi-future/me" };
}

// ─── LIST DELEGATES FOR CHAPTER (for Google OAuth chapter picker) ───
export async function listDelegatesForChapter(
  chapterId: string
): Promise<{ id: string; full_name: string; email: string | null }[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, email")
    .eq("chapter_id", chapterId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data as { id: string; full_name: string; email: string | null }[]) ?? [];
}

// ─── LOGIN DELEGATE BY ID (for Google OAuth after chapter/name pick) ─
export async function loginDelegateById(
  delegateId: string
): Promise<AccessCodeResult> {
  if (!delegateId) return { ok: false, error: "Select your name." };

  const svc = await createServiceClient();
  const { data: delegate } = (await svc
    .schema("future")
    .from("delegates")
    .select("id, edition_id, full_name, is_active")
    .eq("id", delegateId)
    .eq("is_active", true)
    .maybeSingle()) as unknown as {
    data: {
      id: string;
      edition_id: string;
      full_name: string | null;
      is_active: boolean | null;
    } | null;
  };

  if (!delegate) return { ok: false, error: "Delegate not found." };

  await writeSession({
    type: "delegate",
    id: delegate.id,
    edition_id: delegate.edition_id,
    name: delegate.full_name ?? undefined,
  });

  return { ok: true, redirect: "/yi-future/me" };
}

export async function clearAccessCodeSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

// ─── SESSION HELPERS ────────────────────────────────────────────────
//
// The yifuture_session cookie carries a server-trusted identity
// ({ type, id, edition_id, name }) that gates delegate / mentor / jury /
// partner data — including parent-PII consent PDFs. A bare plaintext JSON
// cookie can be hand-forged by anyone who knows or guesses a row UUID, so
// we HMAC-SHA256 sign it. Stored as:  base64url(json) "." base64url(HMAC).
//
// ROLLOUT NOTE (read this before tightening): readSession deliberately
// ACCEPTS legacy plaintext cookies as well as signed ones. A previous
// attempt (#276) fail-closed-rejected every unsigned cookie the moment it
// shipped, which instantly logged out every already-signed-in user and
// looked like "login is broken" (reverted in #294). The dual-accept window
// below is what prevents a repeat. SECURITY: while plaintext is still
// accepted, the forgery vector is open at the SAME level it is today
// (pre-signing) — no regression, but not yet closed. A follow-up should
// flip to signed-only once existing cookies have re-minted (<=30d maxAge).

function getSessionSecret(): string {
  return process.env.YIFUTURE_SESSION_SECRET ?? "";
}

function signPayload(json: string, secret: string): string {
  return createHmac("sha256", secret).update(json).digest("base64url");
}

async function writeSession(payload: SessionPayload): Promise<void> {
  const secret = getSessionSecret();
  const json = JSON.stringify(payload);
  // Sign when a secret is configured. If it is somehow absent, fall back to
  // a plaintext cookie rather than THROWING — a throwing writeSession turns
  // a missing env var into a hard login outage. readSession reads both.
  const value = secret
    ? Buffer.from(json, "utf8").toString("base64url") +
      "." +
      signPayload(json, secret)
    : json;

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  // Disambiguate by first character — no edge cases:
  //   • LEGACY plaintext cookie -> bare JSON, always starts with "{"
  //   • SIGNED cookie           -> base64url(json), always starts with "eyJ"
  //     (base64url of a payload beginning `{"` is always "eyJ...").
  // So a "." inside a delegate's name can NEVER be mistaken for the
  // signature separator, and the two formats never collide.

  // LEGACY plaintext (pre-signing). Accept during the rollout window so
  // in-flight sessions are not mass-logged-out. See ROLLOUT NOTE above.
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw) as SessionPayload;
    } catch {
      return null;
    }
  }

  // SIGNED cookie: "<base64url(json)>.<base64url(hmac)>".
  const secret = getSessionSecret();
  if (!secret) return null; // cannot verify without the secret
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null; // malformed

  const encodedPayload = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSig = signPayload(json, secret);
    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return JSON.parse(json) as SessionPayload;
    }
  } catch {
    return null; // malformed signed cookie
  }
  return null; // signature mismatch — forged / corrupted / wrong secret
}
