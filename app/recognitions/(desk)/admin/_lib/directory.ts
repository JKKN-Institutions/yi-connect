import "server-only";

import { rxService } from "@/lib/recognitions/supabase";
import { RX_APP, RX_ROLES } from "@/lib/recognitions/constants";

/** Roles whose scope is a Yi zone (region): yi_zone is part of what they grant. */
const ZONED_ROLES = new Set<string>([RX_ROLES.rm, RX_ROLES.regionalChair]);

/**
 * Yi directory helpers for the control room. The directory is the mother
 * source of identity: the control room FINDS people by email and never
 * creates one. Role rows are app='recognitions' only.
 */

export type DirectoryPerson = {
  id: string;
  full_name: string;
  email: string | null;
  user_id: string | null;
};

export const NOT_IN_DIRECTORY = "No one in the Yi directory has that email. They need a Yi account first.";

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function findPersonByEmail(
  email: string
): Promise<{ ok: true; person: DirectoryPerson } | { ok: false; error: string }> {
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: "Type a full email address." };
  const { data, error } = await rxService()
    .schema("yi_directory")
    .from("people")
    .select("id, full_name, email, user_id, is_active, merged_into")
    .ilike("email", escapeLike(e))
    .limit(5);
  if (error) return { ok: false, error: "Couldn't search the Yi directory. Try again." };
  const rows = (data ?? []) as Array<DirectoryPerson & { is_active: boolean | null; merged_into: string | null }>;
  // A merged or deactivated person is not a usable identity.
  const usable = rows.filter((r) => r.is_active !== false && !r.merged_into);
  const pick = usable.find((r) => r.user_id) ?? usable[0];
  if (!pick) return { ok: false, error: NOT_IN_DIRECTORY };
  return { ok: true, person: { id: pick.id, full_name: pick.full_name, email: pick.email, user_id: pick.user_id } };
}

type RoleRow = {
  id: string;
  person_id: string;
  role: string;
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_year: number;
  is_active: boolean | null;
};

/** The one directory row for (person, recognitions, role, chapter, year) — the unique scope. */
export async function findRoleRow(input: {
  personId: string;
  role: string;
  yiYear: number;
  yiChapter: string | null;
}): Promise<RoleRow | null> {
  let q = rxService()
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, person_id, role, yi_chapter, yi_zone, yi_year, is_active")
    .eq("person_id", input.personId)
    .eq("app", RX_APP)
    .eq("role", input.role)
    .eq("yi_year", input.yiYear);
  q = input.yiChapter === null ? q.is("yi_chapter", null) : q.eq("yi_chapter", input.yiChapter);
  const { data } = await q.limit(1).maybeSingle();
  return (data as RoleRow | null) ?? null;
}

/**
 * Make sure the directory role row exists and is active. Inserts when
 * missing, reactivates when present but inactive, and moves yi_zone when
 * the caller passes a different one (the caller checks that is safe).
 */
export async function ensureRole(input: {
  personId: string;
  role: string;
  yiYear: number;
  yiChapter: string | null;
  yiZone: string | null;
}): Promise<{ ok: true; change: "inserted" | "reactivated" | "unchanged" } | { ok: false; error: string }> {
  const svc = rxService().schema("yi_directory");
  const existing = await findRoleRow(input);
  if (!existing) {
    const { error } = await svc.from("role_assignments").insert({
      person_id: input.personId,
      app: RX_APP,
      role: input.role,
      yi_chapter: input.yiChapter,
      yi_zone: input.yiZone,
      yi_year: input.yiYear,
      is_active: true,
    });
    if (error) return { ok: false, error: "Couldn't add the role in the Yi directory. Try again." };
    return { ok: true, change: "inserted" };
  }
  // Only the RM and Regional Chair roles are scoped by zone; other roles keep
  // whatever zone they had. The directory key has no zone, so moving the zone
  // means one region per person per year for these roles.
  const zoned = ZONED_ROLES.has(input.role);
  const zoneDiffers = zoned && (existing.yi_zone ?? null) !== (input.yiZone ?? null);
  if (existing.is_active === false || zoneDiffers) {
    const { error } = await svc
      .from("role_assignments")
      .update({
        is_active: true,
        ...(zoned ? { yi_zone: input.yiZone } : {}),
        valid_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "Couldn't update the role in the Yi directory. Try again." };
    return { ok: true, change: "reactivated" };
  }
  return { ok: true, change: "unchanged" };
}
