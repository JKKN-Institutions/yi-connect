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
  /**
   * See scoring / leaderboard / averages / results / committee metrics.
   * Decided 2026-06-13 (product owner): scores are visible to national /
   * super-admins ONLY. canManage (compute / publish / correct) is unchanged —
   * an organiser can still RUN scoring, they just cannot READ the metrics.
   * TRUE only for the super-admin role; FALSE for regional / chapter roles.
   */
  canViewScores: boolean;
  role: YipRole;
  /** Machine-readable reason (for logs / Forbidden messages). */
  reason: string;
};

const DENY: YipEventAccess = {
  canView: false,
  canManage: false,
  canDelete: false,
  canViewScores: false,
  role: "none",
  reason: "not_authorized",
};

/**
 * Full control (view + manage + delete). `canViewScores` defaults to FALSE and
 * is granted ONLY from the super-admin branch — scores/leaderboard/metrics are
 * national/super-admin-only (product-owner decision 2026-06-13). Regional and
 * chapter FULL returns therefore keep canViewScores:false.
 */
const FULL = (
  role: YipRole,
  reason: string,
  canViewScores = false
): YipEventAccess => ({
  canView: true,
  canManage: true,
  canDelete: true,
  canViewScores,
  role,
  reason,
});

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
// Note: norm(null) === norm("") === norm("   ") === "". Callers that use norm()
// for an identity/equality match MUST also require the result be non-empty
// (e.g. `const x = norm(a); if (x && x === norm(b))`), or two independently
// missing values would compare equal and grant access. See chair_email match.

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
    .select("id, chapter_name, yi_zone_code, level")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { ...DENY, reason: "event_not_found" };

  const active = roles.assignments.filter((a) => a.is_active);

  // 1. Platform super-admin (any app) OR YIP super-admin → full, any event.
  //    New scheme: platform_super_admin / yip_super_admin. Legacy super_admin /
  //    national kept during the rename transition (Phase-6 cleanup drops them).
  const isSuper =
    active.some(
      (a) => a.role === "platform_super_admin" || a.role === "super_admin"
    ) ||
    active.some(
      (a) =>
        a.app === "yip" &&
        (a.role === "yip_super_admin" ||
          a.role === "national" ||
          a.role === "super_admin")
    );
  // Super-admin is the ONLY role that may see scores/leaderboard/metrics
  // (product-owner decision 2026-06-13) — pass canViewScores=true here only.
  if (isSuper) return FULL("super_admin", "super_admin", true);

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

  // Chapter authority is CHAPTER-level only: a chapter_admin / chair_email /
  // organiser matches by chapter ONLY for chapter-level events. Regional /
  // national events (even if they carry a chapter_name) are owned by RM (zone,
  // step 2) / national / super (step 1) — a chapter chair is NOT their owner.
  // (2026-06-02; matches the dashboard listing scope.)
  if (event.chapter_name && event.level === "chapter") {
    const chapName = norm(event.chapter_name);

    // 3a. Explicit YIP chapter_admin role for this chapter → full (canonical chair).
    const isExplicitAdmin = active.some(
      (a) =>
        a.app === "yip" &&
        a.role === "chapter_admin" &&
        norm(a.yi_chapter) === chapName
    );
    // Chapter CHAIR sees scores/results (owner decision 2026-06-13: "chapter
    // chair + super-admin"); ordinary organisers + regional stay canViewScores:false.
    if (isExplicitAdmin) return FULL("chapter_admin", "chapter_admin_role", true);

    // 3b. chair_email fallback → full. Whoever logs in with the chapter's
    //     registered chair_email is the admin when no explicit role exists.
    const { data: chapter } = await svc
      .schema("yi")
      .from("chapters")
      .select("chair_email")
      .eq("name", event.chapter_name)
      .maybeSingle();
    // Compare on the NORMALISED value, and require it non-empty, so a null /
    // empty / whitespace-only chair_email can never match a null/empty user
    // email ("" === "" would otherwise grant chair). Fail-closed.
    const chairEmail = norm(chapter?.chair_email);
    const myEmail = norm(roles.email);
    if (chairEmail && myEmail && chairEmail === myEmail) {
      return FULL("chapter_admin", "chapter_admin_email", true);
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
        // Organiser may RUN scoring (canManage) but NOT see the metrics.
        canViewScores: false,
        role: "chapter_organizer",
        reason: "chapter_organizer",
      };
    }
  }

  return DENY;
}

/**
 * National-rollup pages (zones overview, schools directory, topics) show
 * cross-chapter aggregates. Gate to YIP national / super-admins OR any regional
 * admin (decision 2026-06-14) — not chapter organisers.
 */
const NATIONAL_OR_REGIONAL_YIP_ROLES = [
  "yip_super_admin",
  "national",
  "regional_admin",
];
export async function canViewYipNationalRollup(): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  if (!me) return false;
  return me.assignments.some((a) => {
    if (!a.is_active) return false;
    // Platform / cross-app super-admins are always allowed.
    if (a.role === "platform_super_admin" || a.role === "super_admin") return true;
    return a.app === "yip" && NATIONAL_OR_REGIONAL_YIP_ROLES.includes(a.role);
  });
}
