"use server";

// ═══════════════════════════════════════════════════════════════════════
// Chapter Role Assignment — the two-role-per-chapter model (2026-05-30).
//
// Writes yi_directory.role_assignments (app='yip'), which is the SINGLE table
// getYipEventAccess() reads for authorization. (The legacy yip.organizers
// table is NOT consulted by the gate; admin-chapter-admins.ts writes there for
// display only.)
//
// Roles:
//   chapter_admin     — the chair. Full control incl. delete + publish.
//   chapter_organizer — runs the event, cannot delete (manage-only).
//
// Who may assign (per Director interview): the chapter's chair OR national.
// We authorize via getYipEventAccess(eventId).canManage on an event belonging
// to the target chapter (chair + national + regional all pass), which keeps a
// single gate. Super-admins may also assign without an event.
//
// "Exactly one admin" (E7): assigning chapter_admin deactivates any other
// active chapter_admin for that chapter first, and also points
// yi.chapters.chair_email at the new admin so the email-fallback path converges
// on the same person.
//
// Account provisioning: if the target email has no auth user yet, we create one
// with a generated 12-char password returned ONCE for out-of-band sharing
// (same pattern as admin-chapter-admins.ts / national-admins.ts).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";

export type ChapterRoleKind = "chapter_admin" | "chapter_organizer";

export type AssignResult =
  | { ok: true; email: string; password?: string; created: boolean; role: ChapterRoleKind }
  | { ok: false; error: string };

export type ChapterRoleRow = {
  assignment_id: string;
  person_id: string;
  full_name: string;
  email: string | null;
  role: ChapterRoleKind;
  is_active: boolean;
};

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXY" + "abcdefghijkmnpqrstuvwxy" + "3456789";
const PASSWORD_LENGTH = 12;

function generatePassword(): string {
  const bytes = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET.charAt(bytes[i] % PASSWORD_ALPHABET.length);
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Authorize the caller to assign roles for `eventId`'s chapter. Allowed when
 * they can manage that event (chair / national / regional) OR are a YIP
 * super-admin. Returns the event's chapter_name + zone on success.
 */
async function authorizeAssigner(
  eventId: string
): Promise<{ ok: true; chapterName: string; zone: string | null } | { ok: false; error: string }> {
  // Team management is chair-level (canDelete): chair / national / regional /
  // super. Organisers have canManage but must NOT assign or revoke roles —
  // otherwise an organiser could self-promote to chapter_admin (gaining delete)
  // and demote the sitting chair. Per the Director interview, only the chair or
  // national assigns. canDelete is exactly that set.
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { ok: false, error: "Only the chapter chair or national team can manage the team" };
  }
  const svc = await createServiceClient();
  const { data: event } = await svc
    .from("events")
    .select("chapter_name, yi_zone_code")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.chapter_name) {
    return { ok: false, error: "Event has no chapter — cannot scope a chapter role" };
  }
  return { ok: true, chapterName: event.chapter_name, zone: event.yi_zone_code };
}

/** Find-or-create a yi_directory.people row for an email; ensure an auth user. */
async function ensurePerson(
  svc: Svc,
  email: string,
  fullName: string
): Promise<
  | { ok: true; personId: string; created: boolean; password?: string }
  | { ok: false; error: string }
> {
  // 1. Existing person by email?
  const { data: existing } = await svc
    .schema("yi_directory")
    .from("people")
    .select("id, user_id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    return { ok: true, personId: existing.id, created: false };
  }

  // 2. Existing auth user by email? (person row may be missing even if auth exists)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  let authUserId: string | null = null;
  let password: string | undefined;
  let created = false;

  const lookup = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers, cache: "no-store" }
  );
  if (lookup.ok) {
    const body = (await lookup.json()) as { users?: Array<{ id: string; email?: string }> };
    const match = (body.users ?? []).find((u) => norm(u.email ?? "") === norm(email));
    if (match) authUserId = match.id;
  }

  // 3. Create the auth user if none exists.
  if (!authUserId) {
    password = generatePassword();
    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
      cache: "no-store",
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      return {
        ok: false,
        error: `Failed to create login for ${email} (HTTP ${createRes.status}): ${txt.slice(0, 160)}`,
      };
    }
    authUserId = ((await createRes.json()) as { id: string }).id;
    created = true;
  }

  // 4. Insert the people row linked to the auth user.
  const { data: person, error: pErr } = await svc
    .schema("yi_directory")
    .from("people")
    .insert({ user_id: authUserId, email, full_name: fullName, is_active: true })
    .select("id")
    .single();

  if (pErr || !person) {
    return { ok: false, error: `Failed to create directory person: ${pErr?.message ?? "unknown"}` };
  }
  return { ok: true, personId: person.id, created, password };
}

// ─── Assign an organiser or admin to a chapter ───────────────────────

export async function assignChapterRole(input: {
  eventId: string;
  email: string;
  fullName: string;
  role: ChapterRoleKind;
}): Promise<AssignResult> {
  const email = norm(input.email);
  const fullName = input.fullName.trim();
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (fullName.length < 2) return { ok: false, error: "Enter the person's full name." };

  const auth = await authorizeAssigner(input.eventId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const svc = await createServiceClient();

  const person = await ensurePerson(svc, email, fullName);
  if (!person.ok) return { ok: false, error: person.error };

  // "Exactly one admin": when assigning chapter_admin, deactivate any other
  // active chapter_admin for this chapter, then converge chair_email.
  if (input.role === "chapter_admin") {
    await svc
      .schema("yi_directory")
      .from("role_assignments")
      .update({ is_active: false })
      .eq("app", "yip")
      .eq("role", "chapter_admin")
      .eq("yi_chapter", auth.chapterName)
      .neq("person_id", person.personId);

    await svc
      .schema("yi")
      .from("chapters")
      .update({ chair_email: email })
      .eq("name", auth.chapterName);
  }

  // Re-activate an existing matching assignment if present (idempotent), else insert.
  const { data: existingRole } = await svc
    .schema("yi_directory")
    .from("role_assignments")
    .select("id")
    .eq("app", "yip")
    .eq("role", input.role)
    .eq("yi_chapter", auth.chapterName)
    .eq("person_id", person.personId)
    .maybeSingle();

  if (existingRole) {
    await svc
      .schema("yi_directory")
      .from("role_assignments")
      .update({ is_active: true })
      .eq("id", existingRole.id);
  } else {
    const { error: insErr } = await svc
      .schema("yi_directory")
      .from("role_assignments")
      .insert({
        person_id: person.personId,
        app: "yip",
        role: input.role,
        yi_chapter: auth.chapterName,
        yi_zone: auth.zone,
        is_active: true,
        title: `${input.role === "chapter_admin" ? "Chapter Admin" : "Chapter Organiser"} — ${auth.chapterName}`,
      });
    if (insErr) return { ok: false, error: `Failed to assign role: ${insErr.message}` };
  }

  revalidatePath(`/yip/dashboard/events/${input.eventId}/team`);
  return { ok: true, email, password: person.password, created: person.created, role: input.role };
}

// ─── List chapter roles for an event ─────────────────────────────────

export async function listChapterRoles(
  eventId: string
): Promise<{ ok: true; data: ChapterRoleRow[] } | { ok: false; error: string }> {
  // Viewing the team only needs canView (organisers may see who's on the team);
  // assigning/revoking is gated separately by authorizeAssigner (canDelete).
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return { ok: false, error: "Not authorized to view this event's team" };
  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("events")
    .select("chapter_name")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.chapter_name) return { ok: true, data: [] };
  const chapterName = event.chapter_name;

  const { data, error } = await svc
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, person_id, role, is_active, person:people!inner(full_name, email)")
    .eq("app", "yip")
    .eq("yi_chapter", chapterName)
    .in("role", ["chapter_admin", "chapter_organizer"])
    .eq("is_active", true);

  if (error) return { ok: false, error: error.message };

  const rows: ChapterRoleRow[] = (data ?? []).map((r) => {
    const p = r.person as unknown as { full_name: string; email: string | null };
    return {
      assignment_id: r.id,
      person_id: r.person_id,
      full_name: p?.full_name ?? "—",
      email: p?.email ?? null,
      role: r.role as ChapterRoleKind,
      is_active: r.is_active ?? false,
    };
  });
  return { ok: true, data: rows };
}

// ─── Revoke a chapter role ───────────────────────────────────────────

export async function revokeChapterRole(input: {
  eventId: string;
  assignmentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAssigner(input.eventId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const svc = await createServiceClient();
  // Only allow revoking a chapter-scoped role for THIS chapter (safety).
  const { error } = await svc
    .schema("yi_directory")
    .from("role_assignments")
    .update({ is_active: false })
    .eq("id", input.assignmentId)
    .eq("app", "yip")
    .eq("yi_chapter", auth.chapterName)
    .in("role", ["chapter_admin", "chapter_organizer"]);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${input.eventId}/team`);
  return { ok: true };
}

// Used by super-admins to grant without an event context (rare). Kept minimal.
export async function assignChapterRoleAsSuperAdmin(input: {
  chapterName: string;
  zone: string | null;
  email: string;
  fullName: string;
  role: ChapterRoleKind;
}): Promise<AssignResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const email = norm(input.email);
  const fullName = input.fullName.trim();
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (fullName.length < 2) return { ok: false, error: "Enter the person's full name." };

  const svc = await createServiceClient();
  const person = await ensurePerson(svc, email, fullName);
  if (!person.ok) return { ok: false, error: person.error };

  const { error: insErr } = await svc
    .schema("yi_directory")
    .from("role_assignments")
    .insert({
      person_id: person.personId,
      app: "yip",
      role: input.role,
      yi_chapter: input.chapterName,
      yi_zone: input.zone,
      is_active: true,
      title: `${input.role === "chapter_admin" ? "Chapter Admin" : "Chapter Organiser"} — ${input.chapterName}`,
    });
  if (insErr) return { ok: false, error: `Failed to assign role: ${insErr.message}` };

  return { ok: true, email, password: person.password, created: person.created, role: input.role };
}
