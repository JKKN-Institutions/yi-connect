/**
 * Edition stage state machine.
 * Handbook refs: [CPB §4 (3 phases), §5 (chapter final), §6 (advance), HPB §4 (2-day nationals)]
 *
 * Each edition progresses through these stages linearly. Transitions are
 * validated server-side; admin override allowed with reason.
 */

import type { Database } from "@/types/yi-future/database";

export type EditionStage = Database["future"]["Enums"]["edition_stage"];

// ─── ALLOWED TRANSITIONS ────────────────────────────────────────────
const ALLOWED: Record<EditionStage, EditionStage[]> = {
  announcement: ["registration_open"],
  registration_open: ["teams_formed"],
  teams_formed: ["phase_a_active"],
  phase_a_active: ["phase_a_complete"],
  phase_a_complete: ["phase_b_active"],
  phase_b_active: ["phase_b_complete"],
  phase_b_complete: ["phase_c_active"],
  phase_c_active: ["phase_c_complete"],
  phase_c_complete: ["chapter_final_scheduled"],
  chapter_final_scheduled: ["chapter_final_live"],
  chapter_final_live: ["chapter_final_scored"],
  chapter_final_scored: ["shortlist_published"],
  shortlist_published: ["consent_collection"],
  consent_collection: ["national_day_1"],
  national_day_1: ["national_day_2"],
  national_day_2: ["awards_announced"],
  awards_announced: ["post_event_deliverables"],
  post_event_deliverables: ["whitepaper_published"],
  whitepaper_published: ["completed"],
  completed: [],
};

export function canAdvance(from: EditionStage, to: EditionStage): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStage(from: EditionStage): EditionStage | null {
  return ALLOWED[from]?.[0] ?? null;
}

export function stageIndex(stage: EditionStage): number {
  return (
    [
      "announcement",
      "registration_open",
      "teams_formed",
      "phase_a_active",
      "phase_a_complete",
      "phase_b_active",
      "phase_b_complete",
      "phase_c_active",
      "phase_c_complete",
      "chapter_final_scheduled",
      "chapter_final_live",
      "chapter_final_scored",
      "shortlist_published",
      "consent_collection",
      "national_day_1",
      "national_day_2",
      "awards_announced",
      "post_event_deliverables",
      "whitepaper_published",
      "completed",
    ] as EditionStage[]
  ).indexOf(stage);
}

// ─── PREREQUISITE VALIDATION ────────────────────────────────────────
export interface PrerequisiteContext {
  /** Total teams currently registered in this edition */
  teamCount?: number;
  /** Min teams required (from CPB §8) */
  minTeams?: number;
  /** For phase_*_complete: how many phase events are logged */
  phaseEventCount?: number;
  /** For phase_*_complete: how many phase events are required (3 per phase) */
  requiredPhaseEventCount?: number;
  /** For phase_*_complete: how many teams submitted the phase's deliverable */
  teamsWithSubmission?: number;
  /** For advancement: whether all advancing team members have approved consent */
  consentsApproved?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Check if an edition can transition from `from` to `to`.
 * Returns ok=false with reasons if prerequisites unmet.
 * Admin override bypasses this (with audit log entry).
 */
export function validatePrerequisites(
  from: EditionStage,
  to: EditionStage,
  ctx: PrerequisiteContext
): ValidationResult {
  const reasons: string[] = [];

  if (!canAdvance(from, to)) {
    reasons.push(`Transition not allowed: ${from} → ${to}`);
    return { ok: false, reasons };
  }

  // Stage-specific prerequisites
  switch (to) {
    case "teams_formed": {
      const min = ctx.minTeams ?? 5; // [CPB §8: minimum 5 teams per problem statement]
      const count = ctx.teamCount ?? 0;
      if (count < min) {
        reasons.push(
          `Need at least ${min} teams (currently ${count}) [CPB §8]`
        );
      }
      break;
    }

    case "phase_a_complete":
    case "phase_b_complete":
    case "phase_c_complete": {
      const required = ctx.requiredPhaseEventCount ?? 3;
      const logged = ctx.phaseEventCount ?? 0;
      if (logged < required) {
        reasons.push(
          `${required} phase events required, ${logged} logged [CPB §4]`
        );
      }
      if ((ctx.teamsWithSubmission ?? 0) < (ctx.teamCount ?? 0)) {
        reasons.push(
          `Not all teams have submitted this phase's deliverable (${
            ctx.teamsWithSubmission ?? 0
          }/${ctx.teamCount ?? 0})`
        );
      }
      break;
    }

    case "national_day_1": {
      if (ctx.consentsApproved === false) {
        reasons.push(
          "Parent consent letters must be approved for all advancing delegates [CPB §6]"
        );
      }
      break;
    }
  }

  return { ok: reasons.length === 0, reasons };
}
