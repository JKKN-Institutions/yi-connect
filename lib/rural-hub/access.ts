/**
 * Who may read the Rural Hub village answers.
 *
 * Director, 9 Nov 2026: only the Chapter Chair and the Co-Chair. Not the
 * Varnam Vizha committee, not the Rural chair, and not platform admins.
 *
 * Roles come from yi_directory.role_assignments (the mother source), through
 * the shared helper: app='yi', role chapter_chair or chapter_co_chair, for the
 * survey's own chapter. Whoever holds those roles next year gets access with
 * no code change; whoever loses them loses it on the next request.
 *
 * Fails closed: no session, no directory person, or no matching role = deny,
 * with a reason the page shows (never a silent redirect).
 */
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";

const RESULT_ROLES = ["chapter_chair", "chapter_co_chair"];

export type RuralResultsAccess =
  | { canView: true; role: string }
  | { canView: false; signedIn: boolean; reason: string };

export async function getRuralResultsAccess(
  chapter: string
): Promise<RuralResultsAccess> {
  const me = await getCurrentPersonRoles();
  if (!me) {
    return {
      canView: false,
      signedIn: false,
      reason: "Please sign in with your Yi Connect account to see the village answers.",
    };
  }

  const held = me.assignments.find(
    (a) =>
      a.is_active &&
      a.app === "yi" &&
      RESULT_ROLES.includes(a.role) &&
      a.yi_chapter !== null &&
      a.yi_chapter === chapter
  );
  if (!held) {
    return {
      canView: false,
      signedIn: true,
      reason: `Only the Yi ${chapter} Chapter Chair and Co-Chair can see these answers.`,
    };
  }
  return { canView: true, role: held.role };
}
