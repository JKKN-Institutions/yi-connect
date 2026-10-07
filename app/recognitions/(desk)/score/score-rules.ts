import type { Phase } from "@/lib/recognitions/phase";
import { isPast } from "@/lib/recognitions/phase";
import type { CycleRow } from "@/lib/recognitions/types";

/**
 * When may an evaluator write Stage 1 marks or flags? Shared by the sheet
 * page and the server actions so both always agree.
 *   open      phase is stage1 AND the Stage 1 deadline has not passed
 *   notYet    nominations are still open (or the cycle is being set up)
 *   closed    stage1 but the deadline passed
 *   over      a later phase — everything is read-only
 */
export type ScoringWindow =
  | { state: "open" }
  | { state: "notYet" }
  | { state: "closed" }
  | { state: "over" };

export function scoringWindow(phase: Phase, cycle: Pick<CycleRow, "stage1_deadline">): ScoringWindow {
  if (phase === "setup" || phase === "nominations") return { state: "notYet" };
  if (phase !== "stage1") return { state: "over" };
  if (isPast(cycle.stage1_deadline)) return { state: "closed" };
  return { state: "open" };
}

/** "Regional Mentor · region SRTN", "NMT" or "NMT leader". Region codes shown as-is. */
export function dutyLayerLabel(duty: { layer: "rm" | "nmt"; region: string | null; is_nmt_leader: boolean }): string {
  if (duty.layer === "rm") return `Regional Mentor · region ${duty.region ?? ""}`;
  return duty.is_nmt_leader ? "NMT leader" : "NMT";
}
