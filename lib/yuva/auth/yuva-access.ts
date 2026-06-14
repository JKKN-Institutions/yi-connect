/**
 * Yi Youth Academy capability object (Phase 2).
 *
 * Donor: lib/yip/auth/event-access.ts (getYipEventAccess) — but yuva's scope
 * model is simpler, so the entire authorization DECISION is extracted into a
 * PURE resolver (resolveYuvaCaps) that is tsx-testable with zero I/O
 * (lib/yuva/__tests__/yuva-access.test.ts). getYuvaAccess() is the thin IO
 * wrapper: ONE funnel read + ONE yuva query for coordinator academies.
 *
 * Canonical identity rule (CLAUDE.md): roles come from
 * yi_directory.role_assignments via getCurrentPersonRoles() — never from a
 * per-vertical table. The ONLY yuva-side lookup is the coordinator→academy
 * binding (yuva.academies.coordinator_person_id), which is academy data, not
 * a parallel role source.
 *
 * Scope model (spec docs/yi-youth-academy-spec.md → "Auth Helper Design"):
 *   - national  : app='yuva' role yuva_super_admin/yuva_admin (global), or
 *                 the cross-app platform tier — manages everything.
 *   - chapter   : app='yuva' role='chapter_admin' with yi_chapter set —
 *                 manages academies + runs of that chapter ONLY.
 *   - coordinator: app='yuva' role='institution_coordinator' bound via
 *                 yuva.academies.coordinator_person_id — manages the bound
 *                 academy's RUNS only (academy record + mentor network stay
 *                 chapter/national-owned).
 *   - mentor    : manages nothing here (session-level access lives in
 *                 lib/yuva/auth/mentor-access.ts).
 *
 * FAIL CLOSED (project-wide rule): null/unknown scope DENIES with an explicit
 * reason — a chapter_admin row with NULL yi_chapter grants nothing, and a
 * target with a null chapter/academy_id never matches any scoped path.
 */
import {
  getCurrentPersonRoles,
  chairedChaptersFromRoles,
  type RoleAssignment,
} from "@/lib/yi/auth/yi-directory-roles";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import {
  YUVA_APP,
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_CHAPTER_ADMIN,
  ROLE_INSTITUTION_COORDINATOR,
  ROLE_MENTOR,
} from "@/lib/yuva/constants";

// Cross-app platform tier (new + legacy names during the rename transition —
// same set lib/yip/auth/require-super-admin.ts accepts).
const PLATFORM_SUPER_ROLES = new Set(["platform_super_admin", "super_admin"]);

// app='yuva' national-tier roles (tier model locked 2026-06-01).
const YUVA_NATIONAL_ROLES = new Set<string>([ROLE_SUPER_ADMIN, ROLE_ADMIN]);

/** Minimal structural slice of a role row the resolver needs (pure input). */
export type YuvaRoleLike = Pick<
  RoleAssignment,
  "app" | "role" | "yi_chapter" | "is_active"
>;

/** Target shapes — pass the row you already fetched (or a slice of it). */
export type YuvaAcademyRef = { id: string | null; chapter: string | null };
export type YuvaRunRef = { academy_id: string | null; chapter: string | null };

export type YuvaCaps = {
  isNational: boolean;
  chapterAdminOf: string | null;
  coordinatorAcademyIds: string[];
  isMentor: boolean;
  canManageAcademy: (a: YuvaAcademyRef) => boolean;
  canManageRun: (r: YuvaRunRef) => boolean;
  /** Human-readable verdict of how (or why not) this person is scoped. */
  reason: string;
};

export type YuvaAccess = YuvaCaps & { personId: string | null };

/**
 * PURE capability resolver — no I/O, fully unit-tested.
 *
 * @param roles                  active+inactive role rows from the funnel
 *                               (any app; filtering happens here)
 * @param coordinatorAcademyIds  ids of yuva.academies where this person is
 *                               the bound coordinator (IO wrapper supplies)
 */
export function resolveYuvaCaps(
  roles: YuvaRoleLike[],
  coordinatorAcademyIds: string[]
): YuvaCaps {
  const active = roles.filter((r) => r.is_active);

  // National: platform tier (any app) OR app='yuva' national roles.
  const isNational = active.some(
    (r) =>
      PLATFORM_SUPER_ROLES.has(r.role) ||
      (r.app === YUVA_APP && YUVA_NATIONAL_ROLES.has(r.role))
  );

  // Chapter admin scope — first active yuva chapter_admin row with a real
  // (non-null, non-empty) chapter. A row with NULL yi_chapter is a
  // misprovisioned grant: it must DENY, never default to "all chapters".
  const chapterAdminRows = active.filter(
    (r) => r.app === YUVA_APP && r.role === ROLE_CHAPTER_ADMIN
  );
  const explicitChapterAdminOf =
    chapterAdminRows
      .map((r) => (r.yi_chapter ?? "").trim())
      .find((c) => c.length > 0) ?? null;
  const hasNullChapterAdmin =
    chapterAdminRows.length > 0 && !explicitChapterAdminOf;

  // ADDITIVE oversight (Director, 2026-06-14): a chapter-wide chair
  // (chapter_chair / chapter_co_chair, matched by role name across ANY app, so
  // re-tag-safe) gets chapter-scoped Youth Academy admin BY DEFAULT — layered
  // on top of yuva's own chapter_admin grants, never replacing them. An
  // explicit yuva chapter_admin row wins for the managed-chapter name;
  // otherwise we fall back to the chaired chapter. Fail-closed is inherited:
  // chairedChaptersFromRoles drops chair rows with a null/blank chapter, so a
  // chair with no chapter scope grants nothing here either.
  const chairedChapter = chairedChaptersFromRoles(active)[0] ?? null;
  const chapterAdminOf = explicitChapterAdminOf ?? chairedChapter;

  const boundAcademyIds = coordinatorAcademyIds.filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );

  const isMentor = active.some(
    (r) => r.app === YUVA_APP && r.role === ROLE_MENTOR
  );

  const isCoordinatorRole = active.some(
    (r) => r.app === YUVA_APP && r.role === ROLE_INSTITUTION_COORDINATOR
  );

  // Academy record management (assignCoordinator, qualitative notes, mentor
  // network) is national + owning-chapter ONLY. Coordinators co-manage RUNS,
  // not the academy record (spec: "cannot invite mentors to the chapter
  // network"; academy CRUD itself is requireYuvaNational on top of this).
  const canManageAcademy = (a: YuvaAcademyRef): boolean => {
    if (isNational) return true;
    const target = (a.chapter ?? "").trim();
    if (!target) return false; // fail closed on null/empty target scope
    return chapterAdminOf !== null && target === chapterAdminOf;
  };

  const canManageRun = (r: YuvaRunRef): boolean => {
    if (isNational) return true;
    const targetChapter = (r.chapter ?? "").trim();
    if (
      targetChapter &&
      chapterAdminOf !== null &&
      targetChapter === chapterAdminOf
    ) {
      return true;
    }
    const targetAcademy = (r.academy_id ?? "").trim();
    if (targetAcademy && boundAcademyIds.includes(targetAcademy)) {
      return true;
    }
    return false; // fail closed: null scope matched nothing
  };

  // Explicit verdict string — every deny must be diagnosable in one read.
  let reason: string;
  if (isNational) {
    reason = "national scope (yuva_super_admin / yuva_admin / platform tier)";
  } else if (chapterAdminOf) {
    reason = explicitChapterAdminOf
      ? `chapter_admin scope: ${chapterAdminOf}`
      : `chapter chair (chapter-wide) scope: ${chapterAdminOf}`;
  } else if (hasNullChapterAdmin) {
    reason =
      "chapter_admin role has NULL yi_chapter — fail closed, no chapter scope granted";
  } else if (boundAcademyIds.length > 0) {
    reason = `institution_coordinator scope: academy ${boundAcademyIds.join(", ")}`;
  } else if (isCoordinatorRole) {
    reason =
      "institution_coordinator role with no bound academy (yuva.academies.coordinator_person_id) — fail closed";
  } else if (isMentor) {
    reason =
      "mentor role grants no management capability (session access via mentor-access.ts)";
  } else {
    reason = "no active yuva roles — all management denied";
  }

  return {
    isNational,
    chapterAdminOf,
    coordinatorAcademyIds: boundAcademyIds,
    isMentor,
    canManageAcademy,
    canManageRun,
    reason,
  };
}

/** All-deny capability object (unauthenticated / no directory identity). */
function deniedAccess(reason: string): YuvaAccess {
  return {
    personId: null,
    isNational: false,
    chapterAdminOf: null,
    coordinatorAcademyIds: [],
    isMentor: false,
    canManageAcademy: () => false,
    canManageRun: () => false,
    reason,
  };
}

/**
 * IO wrapper — resolves the current session user's yuva capabilities.
 *
 * Reads: getCurrentPersonRoles() funnel (yi_directory) + ONE yuva query for
 * the coordinator→academy binding. Everything else is the pure resolver.
 */
export async function getYuvaAccess(): Promise<YuvaAccess> {
  const me = await getCurrentPersonRoles();
  if (!me) {
    return deniedAccess(
      "not authenticated or no yi_directory identity — all management denied"
    );
  }

  // Coordinator binding lives on the academy row (locked decision: no
  // per-app columns on role_assignments). Inactive academies grant nothing.
  let coordinatorAcademyIds: string[] = [];
  const holdsCoordinatorRole = me.assignments.some(
    (a) =>
      a.is_active &&
      a.app === YUVA_APP &&
      a.role === ROLE_INSTITUTION_COORDINATOR
  );
  if (holdsCoordinatorRole) {
    const svc = await createServiceClient();
    const { data: rows, error } = await svc
      .from("academies")
      .select("id")
      .eq("coordinator_person_id", me.person_id)
      .eq("is_active", true);
    // Fail closed: a lookup error yields NO coordinator scope (never guess).
    coordinatorAcademyIds = error ? [] : (rows ?? []).map((r) => r.id);
  }

  return {
    personId: me.person_id,
    ...resolveYuvaCaps(me.assignments, coordinatorAcademyIds),
  };
}
