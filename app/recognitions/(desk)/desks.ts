import { isChecker, type RxViewer } from "@/lib/recognitions/auth";
import { canSeeBoards } from "@/lib/recognitions/board";
import { CHECK_STEP_ENABLED } from "@/lib/recognitions/constants";
import type { DeskLink } from "./desk-nav";

/** The desks a viewer may open, in the order the process runs. */
export function desksFor(v: RxViewer): DeskLink[] {
  const desks: DeskLink[] = [];
  if (v.chapters.length > 0) desks.push({ href: "/recognitions/chapter", label: "Chapter" });
  // Regional Chairs and Regional Mentors check nominations before scoring (recognitions_02).
  // Not used in 2026 (Director, 2026-10-15): hidden behind CHECK_STEP_ENABLED, not deleted.
  if (CHECK_STEP_ENABLED && isChecker(v)) desks.push({ href: "/recognitions/check", label: "Check" });
  if (v.duties.length > 0) desks.push({ href: "/recognitions/score", label: "Scoring" });
  if (v.duties.some((d) => d.layer === "nmt")) desks.push({ href: "/recognitions/moderate", label: "Stage 2" });
  // The two boards (27 Oct): National Leadership, the NMT and Regional Mentors (their region only).
  if (canSeeBoards(v)) {
    desks.push({ href: "/recognitions/board", label: "Board" });
    desks.push({ href: "/recognitions/predictor", label: "Predictor" });
  }
  if (v.isNationalLeadership || v.isSuperAdmin) desks.push({ href: "/recognitions/review", label: "Review" });
  if (v.isSuperAdmin) desks.push({ href: "/recognitions/admin", label: "Control room" });
  return desks;
}
