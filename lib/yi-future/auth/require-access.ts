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

  // National / super via yi_directory. The yi-future client's generated types
  // don't model the yi_directory schema, so detach typing (`as never`) and
  // cast the result locally — the established pattern for cross-schema reads
  // here (see feedback_yi_directory_typed_vs_loose_cast).
  let isNational = false;
  const { data: personRaw } = await svc
    .schema("yi_directory" as never)
    .from("people" as never)
    .select("id")
    .eq("user_id" as never, user.id as never)
    .maybeSingle();
  const person = personRaw as { id: string } | null;
  if (person) {
    const { data: rolesRaw } = await svc
      .schema("yi_directory" as never)
      .from("role_assignments" as never)
      .select("role, is_active")
      .eq("person_id" as never, person.id as never);
    const roles =
      (rolesRaw as unknown as { role: string; is_active: boolean }[] | null) ??
      [];
    isNational = roles.some(
      (r) => r.is_active && FUTURE_NATIONAL_ROLES.has(r.role)
    );
  }

  // Chapter admin via future.chapter_core_team (future schema IS typed for
  // this client; only `role` is missing from generated types and we don't
  // select it here).
  const { data: cctRaw } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("chapter_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  const chapterIds = (
    (cctRaw as { chapter_id: string | null }[] | null) ?? []
  )
    .map((r) => r.chapter_id)
    .filter((c): c is string => !!c);

  return { userId: user.id, isNational, chapterIds };
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
