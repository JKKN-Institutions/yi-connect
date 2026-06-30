/**
 * Yi Future authorization gates.
 *
 * Background (2026-06-13 security fix): every Yi Future admin server action
 * was gated by a local `requireAuth()` that only checked "is the caller
 * logged in" — using the service client (RLS-bypassing) to mutate ANY row.
 * That let any authenticated user (including a delegate who just registered)
 * regenerate another delegate's access code, delete delegates, edit national
 * config, etc. These helpers replace that login-only check with real role
 * checks, failing CLOSED and denying EXPLICITLY (redirect to a 403 page, not
 * a silent bounce to a landing page).
 *
 * Role sources (canonical):
 *   - National / super:  yi_directory.role_assignments where app='future' and
 *     role in ('future_admin','future_super_admin'), OR a platform super-admin
 *     (role='platform_super_admin', the Director). is_active only.
 *   - Chapter admin:     future.chapter_core_team active rows for this user
 *     (chapter_chair, chapter_co_chair, and other core-team roles). The set of
 *     chapter_ids the user administers is returned for chapter-scoped checks.
 */
import { redirect } from "next/navigation";
import {
  createClient,
  createServiceClient,
} from "@/lib/yi-future/supabase/server";

export type FutureAccess = {
  userId: string;
  /** future_admin / future_super_admin / platform_super_admin. */
  isNational: boolean;
  /** chapter_ids where the user is on an active core team. */
  chapterIds: string[];
};

const FUTURE_NATIONAL_ROLES = new Set([
  "future_admin",
  "future_super_admin",
  "platform_super_admin",
]);

// Chapter-level Yi Future roles in yi_directory. A holder of any of these for a
// chapter is a chapter admin for that chapter — even if they were never synced
// into future.chapter_core_team (the cache). yi_directory is the mother source.
const FUTURE_CHAPTER_ROLES = new Set([
  "chapter_chair",
  "chapter_co_chair",
  "chapter_event_lead",
  "college_outreach_lead",
  "mentorship_content_lead",
  "ops_documentation_lead",
]);

/**
 * Resolve the current user's Yi Future access. Returns null if not logged in.
 * Never throws on "not an admin" — that's the caller's policy decision.
 */
async function resolveFutureAccess(): Promise<FutureAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = await createServiceClient();
  // yi_directory + future.chapters (a VIEW) aren't in the generated future types
  // → loose client for those reads (the established cross-schema pattern; see
  // feedback_yi_directory_typed_vs_loose_cast).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dir = svc as any;

  // Resolve the directory person by user_id, FALLING BACK to email. Chapter
  // chairs/leads are seeded into yi_directory.people with user_id NULL until
  // their first sign-in, so a user_id-only match locked them out with a 403
  // (the symptom this fixes). When matched by verified email, self-heal the
  // user_id link so every other gate (chapter_core_team, getCurrentPersonRoles)
  // recognises them next time.
  let personId: string | null = null;
  {
    const { data } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    personId = (data as { id: string } | null)?.id ?? null;
  }
  if (!personId && user.email) {
    const { data } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, user_id")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();
    const p = data as { id: string; user_id: string | null } | null;
    if (p) {
      personId = p.id;
      if (!p.user_id) {
        await dir
          .schema("yi_directory")
          .from("people")
          .update({ user_id: user.id })
          .eq("id", p.id);
      }
    }
  }

  let isNational = false;
  const chapterIds = new Set<string>();

  if (personId) {
    const { data: rolesRaw } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .select("role, is_active, app, yi_chapter")
      // Scope to this app + platform-wide roles so a same-named role in
      // another vertical can never grant Yi Future access.
      .eq("person_id", personId)
      .in("app", ["future", "platform"]);
    const roles =
      (rolesRaw as {
        role: string;
        is_active: boolean;
        app: string;
        yi_chapter: string | null;
      }[] | null) ?? [];

    isNational = roles.some(
      (r) => r.is_active && FUTURE_NATIONAL_ROLES.has(r.role)
    );

    // Chapter-level roles → resolve the chapter by NAME (yi_directory stores the
    // chapter name in yi_chapter, not the future.chapters id).
    const chapterNames = [
      ...new Set(
        roles
          .filter(
            (r) =>
              r.is_active &&
              r.app === "future" &&
              FUTURE_CHAPTER_ROLES.has(r.role) &&
              !!r.yi_chapter
          )
          .map((r) => r.yi_chapter as string)
      ),
    ];
    if (chapterNames.length > 0) {
      const { data: chRows } = await dir
        .schema("future")
        .from("chapters")
        .select("id, name")
        .in("name", chapterNames);
      for (const c of (chRows as { id: string; name: string }[] | null) ?? []) {
        if (c.id) chapterIds.add(c.id);
      }
    }
  }

  // Union the per-vertical cache (future.chapter_core_team by user_id).
  const { data: cctRaw } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("chapter_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  for (const r of (cctRaw as { chapter_id: string | null }[] | null) ?? []) {
    if (r.chapter_id) chapterIds.add(r.chapter_id);
  }

  return { userId: user.id, isNational, chapterIds: [...chapterIds] };
}

/**
 * Non-redirecting variant of the resolver, exported for actions that must make
 * their own policy decision (e.g. "caller is the assigned jury OR a Future
 * admin") and return a structured error instead of bouncing to /forbidden.
 * Returns null when not logged in via Supabase Auth (access-code sessions are
 * NOT Supabase users, so a jury member resolves to null here — that's expected;
 * the caller falls back to the access-code session check).
 */
export async function resolveFutureAccessOrNull(): Promise<FutureAccess | null> {
  return resolveFutureAccess();
}

/**
 * Require ANY Yi Future admin (national OR any chapter core-team membership).
 * Blocks plain delegates from every admin action. Redirects to login if not
 * authenticated, to /yi-future/forbidden if authenticated but not an admin.
 */
export async function requireFutureAdmin(): Promise<FutureAccess> {
  const access = await resolveFutureAccess();
  if (!access) redirect("/yi-future/login");
  if (!access.isNational && access.chapterIds.length === 0) {
    redirect("/yi-future/forbidden");
  }
  return access;
}

/**
 * Require a NATIONAL Yi Future admin (national config: rubrics, sections,
 * awards, stages, ...). Chapter chairs are denied.
 */
export async function requireFutureNationalAdmin(): Promise<FutureAccess> {
  const access = await resolveFutureAccess();
  if (!access) redirect("/yi-future/login");
  if (!access.isNational) redirect("/yi-future/forbidden");
  return access;
}

/**
 * Require admin of a SPECIFIC chapter (or national). Use for chapter-scoped
 * mutations (regenerate a delegate's access code, delete a delegate, ...) so a
 * chair of chapter A cannot act on chapter B. Look up the target row's
 * chapter_id first, then call this with it.
 */
export async function requireChapterAdmin(
  chapterId: string | null | undefined
): Promise<FutureAccess> {
  const access = await resolveFutureAccess();
  if (!access) redirect("/yi-future/login");
  if (access.isNational) return access;
  if (chapterId && access.chapterIds.includes(chapterId)) return access;
  redirect("/yi-future/forbidden");
}
