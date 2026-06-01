"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/yi-future/constants";

// ─── SHARED ─────────────────────────────────────────────────────────
type AccessCodeRole = "delegate" | "mentor" | "jury" | "partner";

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

  return {
    ok: false,
    error: "That code was not recognized. Check the letters and try again.",
  };
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
// ({ type, id, edition_id, name }) that gates access to delegate /
// mentor / jury / partner data — including parent-PII consent PDFs.
// It MUST therefore be cryptographically signed: a plaintext JSON
// cookie can be hand-forged by anyone who knows or guesses a row UUID,
// letting them impersonate that person server-side (httpOnly/secure do
// not defend against forgery). We store the cookie as
//   base64url(json) "." base64url(HMAC-SHA256(json))
// and reject any value whose recomputed HMAC does not match.

function getSessionSecret(): string {
  const secret = process.env.YIFUTURE_SESSION_SECRET;
  if (!secret || secret.length === 0) return "";
  return secret;
}

function signPayload(json: string, secret: string): string {
  return createHmac("sha256", secret).update(json).digest("base64url");
}

async function writeSession(payload: SessionPayload): Promise<void> {
  const secret = getSessionSecret();
  if (!secret) {
    // FAIL CLOSED: never write an unsigned/forgeable cookie. The
    // YIFUTURE_SESSION_SECRET env var MUST be set (e.g. in Vercel)
    // before access-code / OAuth logins can succeed.
    throw new Error(
      "YIFUTURE_SESSION_SECRET is not set; refusing to write an unsigned session cookie."
    );
  }

  const json = JSON.stringify(payload);
  const value =
    Buffer.from(json, "utf8").toString("base64url") +
    "." +
    signPayload(json, secret);

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
  const secret = getSessionSecret();
  // FAIL CLOSED: with no secret we cannot verify any signature, so we
  // treat every request as logged-out rather than trusting raw cookies.
  if (!secret) return null;

  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null; // malformed / legacy unsigned

  const encodedPayload = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);

  let json: string;
  try {
    json = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = signPayload(json, secret);

  // Constant-time comparison; bail if lengths differ (timingSafeEqual
  // throws on length mismatch, so guard first).
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}
