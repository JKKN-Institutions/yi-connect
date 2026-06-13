/**
 * Yi Youth Academy guide — viewer → lane detection.
 *
 * The guide is ONE page that opens on the viewer's own lane. Detection reuses
 * the existing auth surfaces only (no new auth logic):
 *   - staff identity + scope:  getYuvaAccess()        (lib/yuva/auth/yuva-access.ts)
 *   - student session cookie:  getStudentSession()    (lib/yuva/auth/student-session.ts)
 *
 * Priority (most-specific wins): national → chapter_admin → coordinator →
 * mentor → student → applicant (the public default for a logged-out visitor).
 *
 * Managers who onboard other people (national / chapter / coordinator) may
 * VIEW and DOWNLOAD other lanes too, so they can hand the right guide to a
 * student or mentor. Mentors / students / applicants stay on their own lane.
 */
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import type { GuideLane } from "@/lib/yuva/guide/content";

export type DetectedLane = {
  /** The lane the page opens on. */
  lane: GuideLane;
  /** May this viewer switch to / download lanes other than their own? */
  canViewOtherLanes: boolean;
};

export async function detectGuideLane(): Promise<DetectedLane> {
  const access = await getYuvaAccess();

  if (access.isNational) {
    return { lane: "national", canViewOtherLanes: true };
  }
  if (access.chapterAdminOf) {
    return { lane: "chapter_admin", canViewOtherLanes: true };
  }
  if (access.coordinatorAcademyIds.length > 0) {
    return { lane: "coordinator", canViewOtherLanes: true };
  }
  if (access.isMentor) {
    return { lane: "mentor", canViewOtherLanes: false };
  }

  // No staff scope — a student carries a signed yuva_session cookie instead.
  const student = await getStudentSession();
  if (student) {
    return { lane: "student", canViewOtherLanes: false };
  }

  // Logged-out visitor → the public "how to apply" lane.
  return { lane: "applicant", canViewOtherLanes: false };
}
