import "server-only";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";

/**
 * Per-chapter YIP authorization — the single source of truth for "what may
 * this user do on this event". Replaces the brittle `events.created_by ===
 * user.id` ownership checks scattered across app/yip/actions/*.
 *
 * Capability model (decided 2026-05-30, Director interview):
 *   canView    — see the event + sub-pages.
 *   canManage  — ALL organising actions: import, allocate, lock/unlock,
 *                manage parties/jury/topics/venue, assign roles, run the live
 *                control panel, check-in, compute AND publish results.
 *                (Organiser is explicitly allowed to go live and publish.)
 *   canDelete  — delete rows (students/parties/jury/etc.) and delete the
 *                event. CHAIR-ONLY. This is the ONLY thing an organiser cannot do.
 *
 * Roles (yi_directory.role_assignments, app='yip', scoped by yi_chapter =
 * event.chapter_name):
 *   chapter_admin     — the chair. canView + canManage + canDelete.
 *   chapter_organizer — canView + canManage, NOT canDelete.
 *
 * Chair (= chapter_admin) is granted by EITHER:
 *   (a) an explicit app='yip', role='chapter_admin' assignment for the chapter, OR
 *   (b) the user's email matching yi.chapters.chair_email (case/space-insensitive).
 * Precedence for "exactly one admin": an explicit chapter_admin role is the
 * canonical admin; the chair_email path is the fallback when no explicit role
 * exists. Both grant identical (full) capability, so there is never a conflict
 * in what the admin can do — only one *effective* admin is ever needed.
 *
 * Above chapters: an active YIP national / platform super_admin (full on every
 * event), or a regional_admin for the event's zone (full within their zone).
 *
 * `events.created_by` is NOT an authorization signal under this model.
 */

export type YipRole =
  | "super_admin"
  | "regional_admin"
  | "chapter_admin"
  | "chapter_organizer"
  | "none";

export type YipEventAccess = {
  canView: boolean;
  canManage: boolean;
  canDelete: boolean;
  role: YipRole;
  /** Machine-readable reason (for logs / Forbidden messages). */
  reason: string;
};

const DENY: YipEventAccess = {
  canView: false,
  canManage: false,
  canDelete: false,
  role: "none",
  reason: "not_authorized",
};

/** Full control (view + manage + delete). */
const FULL = (role: YipRole, reason: string): YipEventAccess => ({
  canView: true,
  canManage: true,
  canDelete: true,
  role,
  reason,
});

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Resolve the current user's capabilities on a specific YIP event.
 * Always returns an object — callers check the boolean they need and, on
 * failure, render Forbidden403 (view) or return a structured error (actions).
 */
export async function getYipEventAccess(eventId: string): Promise<YipEventAccess> {
  const roles = await getCurrentPersonRoles();
  if (!roles) return { ...DENY, reason: "unauthenticated" };

  const svc = await createServiceClient();
  const { data: event } = await svc
    .from("events")
    .select("id, chapter_name, yi_zone_code")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { ...DENY, reason: "event_not_found" };

  const active = roles.assignments.filter((a) => a.is_active);

  // 1. Platform super_admin (any app) OR YIP national/super_admin → full, any event.
  const isSuper =
    active.some((a) => a.role === "super_admin") ||
    active.some(
      (a) => a.app === "yip" && (a.role === "national" || a.role === "super_admin")
    );
  if (isSuper) return FULL("super_admin", "super_admin");

  // 2. Regional admin for the event's zone → full within the zone.
  if (
    event.yi_zone_code &&
    active.some(
      (a) =>
        a.app === "yip" &&
        a.role === "regional_admin" &&
        a.yi_zone === event.yi_zone_code
    )
  ) {
    return FULL("regional_admin", "regional_admin");
  }

  if (event.chapter_name) {
    const chapName = norm(event.chapter_name);

    // 3a. Explicit YIP chapter_admin role for this chapter → full (canonical chair).
    const isExplicitAdmin = active.some(
      (a) =>
        a.app === "yip" &&
        a.role === "chapter_admin" &&
        norm(a.yi_chapter) === chapName
    );
    if (isExplicitAdmin) return FULL("chapter_admin", "chapter_admin_role");

    // 3b. chair_email fallback → full. Whoever logs in with the chapter's
    //     registered chair_email is the admin when no explicit role exists.
    const { data: chapter } = await svc
      .schema("yi")
      .from("chapters")
      .select("chair_email")
      .eq("name", event.chapter_name)
      .maybeSingle();
    if (chapter?.chair_email && norm(chapter.chair_email) === norm(roles.email)) {
      return FULL("chapter_admin", "chapter_admin_email");
    }

    // 3c. chapter_organizer → manage but NOT delete.
    const isOrganiser = active.some(
      (a) =>
        a.app === "yip" &&
        a.role === "chapter_organizer" &&
        norm(a.yi_chapter) === chapName
    );
    if (isOrganiser) {
      return {
        canView: true,
        canManage: true,
        canDelete: false,
        role: "chapter_organizer",
        reason: "chapter_organizer",
      };
    }
  }

  return DENY;
}
