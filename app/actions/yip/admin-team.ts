"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import type { YiZone, YiRole } from "@/lib/yip/hierarchy";

// ─── Types ──────────────────────────────────────────────────────

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TeamMember = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  role: YiRole;
  zone: YiZone | null;
  chapter_name: string | null;
  title: string | null;
  photo_url: string | null;
  is_active: boolean;
  yi_year: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MemberInput = {
  full_name: string;
  email?: string | null;
  role: YiRole;
  zone?: YiZone | null;
  chapter_name?: string | null;
  title?: string | null;
  photo_url?: string | null;
};

// ─── Validation ─────────────────────────────────────────────────

function validateMember(input: MemberInput): string | null {
  if (!input.full_name || input.full_name.trim().length < 2) {
    return "Full name is required (min 2 characters)";
  }
  if (input.role === "national") {
    if (input.zone) return "National members cannot have a zone";
  } else if (input.role === "rm") {
    if (!input.zone) return "RMs must have a zone";
  } else if (input.role === "chapter_em") {
    if (!input.chapter_name || input.chapter_name.trim().length < 2) {
      return "Chapter EMs must have a chapter name";
    }
  }
  return null;
}

function normalizeInput(input: MemberInput): MemberInput {
  const normalized: MemberInput = {
    full_name: input.full_name.trim(),
    email: input.email?.trim() || null,
    role: input.role,
    zone: input.role === "national" ? null : input.zone ?? null,
    chapter_name:
      input.role === "chapter_em" ? input.chapter_name?.trim() || null : null,
    title: input.title?.trim() || null,
    photo_url: input.photo_url?.trim() || null,
  };
  return normalized;
}

// ─── Actions ────────────────────────────────────────────────────

export async function adminListTeam(filters?: {
  role?: YiRole;
  zone?: YiZone;
  includeInactive?: boolean;
}): Promise<TeamMember[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("organizer_profiles")
    .select("*, person_id")
    .order("role")
    .order("zone", { nullsFirst: true })
    .order("full_name");

  if (!filters?.includeInactive) {
    q = q.eq("is_active", true);
  }
  if (filters?.role) q = q.eq("role", filters.role);
  if (filters?.zone) q = q.eq("zone", filters.zone);

  const { data, error } = await q;
  if (error) {
    console.error("adminListTeam error:", error);
    return [];
  }
  const rows = (data ?? []) as unknown as Array<
    TeamMember & { person_id: string | null }
  >;

  // Resolve canonical identity from yi_directory.people. Cast: schema not in
  // generated types (migrations 023-025). Re-run `supabase gen types
  // --schema yi_directory` to remove.
  const personIds = Array.from(
    new Set(rows.map((r) => r.person_id).filter((x): x is string => Boolean(x)))
  );
  const personById = new Map<string, { full_name: string; email: string | null; photo_url: string | null }>();
  const yearBySourceId = new Map<string, number>();

  if (personIds.length > 0) {
    // Cast: yi_directory schema not yet in generated types.
    const svcDir = supabase.schema("yi_directory" as never) as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (k: string, v: string[]) => Promise<{
            data: Array<Record<string, unknown>> | null;
          }>;
        };
      };
    };
    const { data: people } = await svcDir
      .from("people")
      .select("id, full_name, email, photo_url")
      .in("id", personIds);
    for (const p of (people ?? []) as Array<{
      id: string;
      full_name: string;
      email: string | null;
      photo_url: string | null;
    }>) {
      personById.set(p.id, {
        full_name: p.full_name,
        email: p.email,
        photo_url: p.photo_url,
      });
    }

    // Pull yi_year per organizer_profile via role_assignments.
    const sourceIds = rows.map((r) => r.id);
    const { data: assignments } = await svcDir
      .from("role_assignments")
      .select("source_yip_profile_id, yi_year")
      .in("source_yip_profile_id", sourceIds);
    for (const a of (assignments ?? []) as Array<{
      source_yip_profile_id: string | null;
      yi_year: number;
    }>) {
      if (a.source_yip_profile_id) {
        yearBySourceId.set(a.source_yip_profile_id, a.yi_year);
      }
    }
  }

  return rows.map((r) => {
    const person = r.person_id ? personById.get(r.person_id) : undefined;
    return {
      ...r,
      full_name: person?.full_name ?? r.full_name,
      email: person?.email ?? r.email,
      photo_url: person?.photo_url ?? r.photo_url,
      yi_year: yearBySourceId.get(r.id) ?? null,
    };
  });
}

export async function adminCreateMember(
  input: MemberInput
): Promise<ActionResult<TeamMember>> {
  const err = validateMember(input);
  if (err) return { success: false, error: err };
  const normalized = normalizeInput(input);

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("organizer_profiles")
    .insert({
      full_name: normalized.full_name,
      email: normalized.email,
      role: normalized.role,
      zone: normalized.zone,
      chapter_name: normalized.chapter_name,
      title: normalized.title,
      photo_url: normalized.photo_url,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/team");
  return {
    success: true,
    data: { ...(data as Omit<TeamMember, "yi_year">), yi_year: null },
  };
}

export async function adminUpdateMember(
  id: string,
  input: MemberInput
): Promise<ActionResult<TeamMember>> {
  const err = validateMember(input);
  if (err) return { success: false, error: err };
  const normalized = normalizeInput(input);

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("organizer_profiles")
    .update({
      full_name: normalized.full_name,
      email: normalized.email,
      role: normalized.role,
      zone: normalized.zone,
      chapter_name: normalized.chapter_name,
      title: normalized.title,
      photo_url: normalized.photo_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/team");
  return {
    success: true,
    data: { ...(data as Omit<TeamMember, "yi_year">), yi_year: null },
  };
}

export async function adminArchiveMember(
  id: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("organizer_profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/team");
  return { success: true, data: null };
}

export async function adminRestoreMember(
  id: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("organizer_profiles")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/team");
  return { success: true, data: null };
}

/**
 * Link an auth.users row to an organizer profile.
 * Accepts either a UUID (user_id) or email. Email lookup requires service role.
 */
export async function adminLinkUser(
  memberId: string,
  userIdOrEmail: string
): Promise<ActionResult<{ user_id: string; email: string | null }>> {
  const trimmed = userIdOrEmail.trim();
  if (!trimmed) return { success: false, error: "Email or user ID required" };

  const supabase = await createServiceClient();

  let userId: string | null = null;
  let userEmail: string | null = null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(trimmed)) {
    // Look up by id
    const { data, error } = await supabase.auth.admin.getUserById(trimmed);
    if (error || !data?.user) {
      return { success: false, error: "No auth user with that ID" };
    }
    userId = data.user.id;
    userEmail = data.user.email ?? null;
  } else {
    // Look up by email — paginate through auth users
    const targetEmail = trimmed.toLowerCase();
    let page = 1;
    const perPage = 1000;
    let found: { id: string; email: string | null } | null = null;

    // Cap at 10 pages (10k users) for safety
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) return { success: false, error: error.message };
      const users = data?.users ?? [];
      const match = users.find(
        (u) => (u.email ?? "").toLowerCase() === targetEmail
      );
      if (match) {
        found = { id: match.id, email: match.email ?? null };
        break;
      }
      if (users.length < perPage) break;
      page += 1;
    }

    if (!found) {
      return {
        success: false,
        error: `No auth user found with email ${trimmed}`,
      };
    }
    userId = found.id;
    userEmail = found.email;
  }

  const { error: updErr } = await supabase
    .from("organizer_profiles")
    .update({
      user_id: userId,
      email: userEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (updErr) return { success: false, error: updErr.message };
  revalidatePath("/dashboard/admin/team");
  return { success: true, data: { user_id: userId!, email: userEmail } };
}

export async function adminUnlinkUser(
  memberId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("organizer_profiles")
    .update({ user_id: null, updated_at: new Date().toISOString() })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/team");
  return { success: true, data: null };
}
