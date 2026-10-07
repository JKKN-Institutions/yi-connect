/**
 * Where an award is in the process — derived from deadlines and facts, never
 * a status someone has to remember to flip.
 *
 *   setup         no nomination deadline set yet
 *   nominations   until the nomination deadline (Phase 1)
 *   stage1        nominations locked; RM + NMT blind scoring (Phase 2)
 *   stage2        100% scored (or force-unlocked); NMT leader moderates (Phase 3)
 *   governance    moderation submitted; National Leadership decides (Phase 4)
 *   reevaluation  sent back; NMT leader revises (Phase 5)
 *   finalized     approved
 */

import type { AwardRow, CycleRow, DecisionRow, ModerationVersionRow } from "./types";

export type Phase =
  | "setup"
  | "nominations"
  | "stage1"
  | "stage2"
  | "governance"
  | "reevaluation"
  | "finalized";

export const PHASE_LABEL: Record<Phase, string> = {
  setup: "Being set up",
  nominations: "Nominations open",
  stage1: "Stage 1 · scoring",
  stage2: "Stage 2 · moderation",
  governance: "Awaiting National Leadership",
  reevaluation: "Stage 3 · re-evaluation",
  finalized: "Finalised",
};

export function computePhase(input: {
  cycle: Pick<CycleRow, "nomination_deadline">;
  award: Pick<AwardRow, "stage2_unlocked_at">;
  stage1Complete: boolean;
  latestVersion: ModerationVersionRow | null;
  decisions: DecisionRow[];
  now?: Date;
}): Phase {
  const now = input.now ?? new Date();
  const nd = input.cycle.nomination_deadline;
  if (!nd) return "setup";
  if (now.getTime() <= Date.parse(nd)) return "nominations";

  const v = input.latestVersion;
  if (v) {
    if (v.status === "draft") return v.responds_to_decision_id ? "reevaluation" : "stage2";
    const decision = latestDecisionFor(input.decisions, v.id);
    if (!decision) return "governance";
    return decision.decision === "approve" ? "finalized" : "reevaluation";
  }
  if (input.award.stage2_unlocked_at || input.stage1Complete) return "stage2";
  return "stage1";
}

export function latestDecisionFor(decisions: DecisionRow[], versionId: string): DecisionRow | null {
  const mine = decisions
    .filter((d) => d.moderation_version_id === versionId)
    .sort((a, b) => Date.parse(b.decided_at) - Date.parse(a.decided_at));
  return mine[0] ?? null;
}

/** True when `deadline` is set and has passed. A missing deadline never locks. */
export function isPast(deadline: string | null, now: Date = new Date()): boolean {
  return !!deadline && now.getTime() > Date.parse(deadline);
}
