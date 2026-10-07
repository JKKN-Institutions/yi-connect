import type { RxViewer } from "@/lib/recognitions/auth";
import type { DeskLink } from "./desk-nav";

/** The desks a viewer may open, in the order the process runs. */
export function desksFor(v: RxViewer): DeskLink[] {
  const desks: DeskLink[] = [];
  if (v.chapters.length > 0) desks.push({ href: "/recognitions/chapter", label: "Chapter" });
  if (v.duties.length > 0) desks.push({ href: "/recognitions/score", label: "Scoring" });
  if (v.duties.some((d) => d.layer === "nmt")) desks.push({ href: "/recognitions/moderate", label: "Stage 2" });
  if (v.isNationalLeadership || v.isSuperAdmin) desks.push({ href: "/recognitions/review", label: "Review" });
  if (v.isSuperAdmin) desks.push({ href: "/recognitions/admin", label: "Control room" });
  return desks;
}
