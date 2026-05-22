"use server";

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
      redirect: firstUnlock ? "/join?just_joined=1" : "/me",
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
    return { ok: true, redirect: "/mentor" };
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
    return { ok: true, redirect: "/jury" };
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
    return { ok: true, redirect: "/partner" };
  }

  return {
    ok: false,
    error: "That code was not recognized. Check the letters and try again.",
  };
}

export async function clearAccessCodeSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

// ─── SESSION HELPERS ────────────────────────────────────────────────
async function writeSession(payload: SessionPayload): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, JSON.stringify(payload), {
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
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}
