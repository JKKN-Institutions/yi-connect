import "server-only";

import { cache } from "react";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";

/**
 * Per-chapter YIQ authorization — gate #1 of the two-gate model. The single
 * source of truth for "what may this user do on this chapter event".
 *
 * Capabilities
 *   canView         see the event and its sub-pages
 *   canManage       verify schools, confirm teams, open/close the online
 *                   round, run the finals console, record scores, publish
 *   canDelete       delete teams/schools/the event itself — CHAIR ONLY
 *   canViewScores   read live scores and the Top-10 leaderboard BEFORE they
 *                   are published. National tier only, by design.
 *
 * Roles (yi_directory.role_assignments, app='yiq', scoped by yi_chapter):
 *   chapter_admin      the chair — view + manage + delete
 *   chapter_organizer  view + manage, NOT delete
 *
 * Chair is granted by ANY of:
 *   (a) app='yiq', role='chapter_admin' for the chapter, OR
 *   (b) app='yi', role='chapter_chair'/'chapter_co_chair' for the chapter —
 *       the Yi directory IS the source of truth for who chairs a chapter, so
 *       a directory chair is automatically the YIQ chair, OR
 *   (c) the user's email matching yi.chapters.chair_email.
 *
 * Above chapters: yiq_super_admin / platform_super_admin (any event), or
 * regional_admin for the event's zone (full within that zone).
 *
 * `chapter_events.created_by` is NOT an authorization signal.
 */

export type YiqRole =
  | "super_admin"
  | "regional_admin"
  | "chapter_admin"
  | "chapter_organizer"
  | "none";

export type YiqEventAccess = {
  canView: boolean;
  canManage: boolean;
  canDelete: boolean;
  canViewScores: boolean;
  role: YiqRole;
  /** Machine-readable reason, for logs and the Forbidden page. */
  reason: string;
  chapterName: string | null;
};

const DENY: YiqEventAccess = {
  canView: false,
  canManage: false,
  canDelete: false,
  canViewScores: false,
  role: "none",
  reason: "not_authorized",
  chapterName: null,
};

const FULL = (
  role: YiqRole,
  reason: string,
  chapterName: string | null,
  canViewScores = false
): YiqEventAccess => ({
  canView: true,
  canManage: true,
  canDelete: true,
  canViewScores,
  role,
  reason,
  chapterName,
});

const SUPER_ROLES = new Set([
  "yiq_super_admin",
  "yiq_national",
  "platform_super_admin",
]);

const CHAIR_ROLES = new Set(["chapter_chair", "chapter_co_chair"]);

/**
 * norm(null) === norm("") === norm("   ") === "". Any caller using norm() for
 * an IDENTITY match must also require the result be non-empty, or two
 * independently-missing values compare equal and grant access.
 */
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export const getYiqEventAccess = cache(
  async (chapterEventId: string): Promise<YiqEventAccess> => {
    const roles = await getCurrentPersonRoles();
    if (!roles) return { ...DENY, reason: "unauthenticated" };

    const svc = await createServiceClient();
    const { data: event } = await svc
      .from("chapter_events")
      .select("id, chapter_name, yi_zone")
      .eq("id", chapterEventId)
      .maybeSingle();

    if (!event) return { ...DENY, reason: "event_not_found" };

    const chapter = event.chapter_name;
    const zone = event.yi_zone;
    const active = roles.assignments.filter((a) => a.is_active);

    // --- Tier 1: national / platform super-admin. Sees scores. -----------
    if (active.some((a) => SUPER_ROLES.has(a.role))) {
      return FULL("super_admin", "yiq_super_admin", chapter, true);
    }

    // --- Tier 2: regional admin, within their own zone -------------------
    // FAIL CLOSED: a null/blank zone on either side must DENY, never match.
    // `a.yi_zone && zone && equal` — never `zone && a.yi_zone !== zone`,
    // which silently skips the check when the scope is null.
    const regional = active.find(
      (a) =>
        a.app === "yiq" &&
        a.role === "regional_admin" &&
        norm(a.yi_zone) !== "" &&
        norm(zone) !== "" &&
        norm(a.yi_zone) === norm(zone)
    );
    if (regional) {
      return FULL("regional_admin", "regional_admin_zone_match", chapter);
    }

    // --- Tier 3a: explicit YIQ chapter_admin for this chapter ------------
    const chapterNorm = norm(chapter);
    if (chapterNorm === "") return { ...DENY, reason: "event_has_no_chapter" };

    const yiqChair = active.find(
      (a) =>
        a.app === "yiq" &&
        a.role === "chapter_admin" &&
        norm(a.yi_chapter) === chapterNorm
    );
    if (yiqChair) return FULL("chapter_admin", "yiq_chapter_admin", chapter);

    // --- Tier 3b: Yi directory chapter chair == YIQ chair ----------------
    const directoryChair = active.find(
      (a) =>
        a.app === "yi" &&
        CHAIR_ROLES.has(a.role) &&
        norm(a.yi_chapter) === chapterNorm
    );
    if (directoryChair) {
      return FULL("chapter_admin", "yi_directory_chapter_chair", chapter);
    }

    // --- Tier 3c: yi.chapters.chair_email match --------------------------
    const myEmail = norm(roles.email);
    if (myEmail !== "") {
      const { data: chapterRow } = await svc
        .schema("yi")
        .from("chapters")
        .select("chair_email")
        .eq("name", chapter)
        .maybeSingle();
      const chairEmail = norm(
        (chapterRow as { chair_email?: string | null } | null)?.chair_email
      );
      if (chairEmail !== "" && chairEmail === myEmail) {
        return FULL("chapter_admin", "chapter_chair_email_match", chapter);
      }
    }

    // --- Tier 4: chapter organiser — everything except delete ------------
    const organiser = active.find(
      (a) =>
        a.app === "yiq" &&
        a.role === "chapter_organizer" &&
        norm(a.yi_chapter) === chapterNorm
    );
    if (organiser) {
      return {
        canView: true,
        canManage: true,
        canDelete: false,
        canViewScores: false,
        role: "chapter_organizer",
        reason: "yiq_chapter_organizer",
        chapterName: chapter,
      };
    }

    return { ...DENY, reason: "no_matching_role", chapterName: chapter };
  }
);

/**
 * Action-side helper. Returns a structured error rather than redirecting —
 * a silent redirect to a landing page creates an undiagnosable bounce-loop.
 */
export async function requireYiqEventManage(
  chapterEventId: string
): Promise<
  { ok: true; access: YiqEventAccess } | { ok: false; error: string }
> {
  const access = await getYiqEventAccess(chapterEventId);
  if (!access.canManage) {
    console.log(
      JSON.stringify({
        tag: "yiq_event_gate",
        verdict: "deny",
        chapterEventId,
        reason: access.reason,
      })
    );
    return {
      ok: false,
      error:
        access.reason === "unauthenticated"
          ? "Please sign in to continue."
          : "You do not have permission to manage this chapter's YIQ event.",
    };
  }
  return { ok: true, access };
}

export async function requireYiqEventDelete(
  chapterEventId: string
): Promise<
  { ok: true; access: YiqEventAccess } | { ok: false; error: string }
> {
  const access = await getYiqEventAccess(chapterEventId);
  if (!access.canDelete) {
    return {
      ok: false,
      error: "Only the chapter chair can delete YIQ records.",
    };
  }
  return { ok: true, access };
}

/**
 * Every chapter this user may manage — powers the chapter picker on the
 * dashboard. Super-admins get all events for the active edition.
 */
export async function getManageableChapterEvents(): Promise<
  { id: string; chapter_name: string; status: string; yi_zone: string | null }[]
> {
  const roles = await getCurrentPersonRoles();
  if (!roles) return [];

  const svc = await createServiceClient();
  const { data: edition } = await svc
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!edition) return [];

  const active = roles.assignments.filter((a) => a.is_active);
  const isSuper = active.some((a) => SUPER_ROLES.has(a.role));

  const base = svc
    .from("chapter_events")
    .select("id, chapter_name, status, yi_zone")
    .eq("edition_id", edition.id)
    .order("chapter_name");

  if (isSuper) {
    const { data } = await base;
    return data ?? [];
  }

  const zones = active
    .filter((a) => a.app === "yiq" && a.role === "regional_admin")
    .map((a) => norm(a.yi_zone))
    .filter((z) => z !== "");

  const chapters = active
    .filter(
      (a) =>
        (a.app === "yiq" &&
          (a.role === "chapter_admin" || a.role === "chapter_organizer")) ||
        (a.app === "yi" && CHAIR_ROLES.has(a.role))
    )
    .map((a) => norm(a.yi_chapter))
    .filter((c) => c !== "");

  if (zones.length === 0 && chapters.length === 0) return [];

  const { data } = await base;
  return (data ?? []).filter(
    (e) =>
      chapters.includes(norm(e.chapter_name)) ||
      (norm(e.yi_zone) !== "" && zones.includes(norm(e.yi_zone)))
  );
}
