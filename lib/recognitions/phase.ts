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

/**
 * Early test scoring (Piyush, 29 Oct; the Director agreed 09:33 and, for Stage 2, 12:10):
 * while nominations are still open, Regional Mentors and the NMT may score, and a
 * recognition the super admin forces open moves on to Stage 2, so the whole flow can be
 * tested. It shuts by itself at this moment, before chapters start filing on 1 Nov.
 * Everything made before then (marks, Stage 2 unlocks, rankings, decisions) is wiped.
 */
// Shut early (Director, 30 Oct): chapters start filing real nominations on 1 Nov.
export const EARLY_TEST_SCORING_UNTIL = "2026-10-31T23:59:00+05:30";

export function earlyTestOpen(now: Date = new Date()): boolean {
  return !isPast(EARLY_TEST_SCORING_UNTIL, now);
}

/** Chapters may file only from this moment (Piyush, 30 Oct: the mailer goes out on 30–31 Oct, filing starts 1 Nov). */
export const NOMINATIONS_OPEN_AT = "2026-11-01T00:00:00+05:30";

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
  // During the early test window, a recognition forced open for testing carries on to Stage 2.
  if (now.getTime() <= Date.parse(nd) && !(input.award.stage2_unlocked_at && earlyTestOpen(now))) {
    return "nominations";
  }

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
