import type { Category, Layer, Vertical } from "./constants";

/**
 * Row shapes for the yi_connect.recognition_* tables. Hand-written because
 * the generated Database type does not cover these tables yet. Every field
 * is REQUIRED (nullable where the column is) — an optional field here would
 * be a silent default.
 */

export type CycleRow = {
  id: string;
  name: string;
  yi_year: number;
  nomination_deadline: string | null;
  /** A sent-back nomination can be fixed and resubmitted until this. */
  fix_deadline: string | null;
  /** Regional Chairs and Regional Mentors check nominations until this. */
  check_deadline: string | null;
  stage1_deadline: string | null;
  stage2_deadline: string | null;
  reevaluation_deadline: string | null;
  weight_layer1: number;
  weight_layer2: number;
  weight_layer3: number;
  layer2_mode: "raw" | "percentile";
  quiz_open: boolean;
  is_current: boolean;
  created_at: string;
};

export type AwardRow = {
  id: string;
  cycle_id: string;
  vertical: Vertical;
  title: string;
  criteria: string | null;
  sort_order: number;
  is_active: boolean;
  stage2_unlocked_at: string | null;
  stage2_unlock_reason: string | null;
  stage2_unlocked_by: string | null;
};

export type ChapterRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

export type EvaluatorRow = {
  id: string;
  award_id: string;
  person_id: string;
  layer: Layer;
  region: string | null;
  is_nmt_leader: boolean;
  conflict_chapter_ids: string[];
  is_active: boolean;
};

export type NominationRow = {
  id: string;
  award_id: string;
  chapter_id: string;
  category: Category;
  region: string;
  status: NominationStatus;
  reasons: string[];
  flagship_event: string;
  hosted_event: boolean;
  hosted_event_name: string | null;
  hosted_event_type: "national" | "regional" | null;
  announcement_draft: string;
  submitted_at: string | null;
  rm_recommended_by: string | null;
  rm_recommended_at: string | null;
  nmt_approved_by: string | null;
  nmt_approved_at: string | null;
  /** The two checks (recognitions_02). Both set = status 'checked'. */
  rc_checked_by: string | null;
  rc_checked_at: string | null;
  rm_checked_by: string | null;
  rm_checked_at: string | null;
  /** The latest send-back. Kept after a resubmission as history. */
  returned_by: string | null;
  returned_at: string | null;
  return_note: string | null;
};

/**
 * Stored nomination status (recognitions_02):
 *   draft      the chapter is still writing it
 *   submitted  filed, awaiting the Regional Chair + Regional Mentor checks
 *   returned   sent back with a note; the chapter may fix it
 *   checked    both checkers passed it: in the race, scored
 *   excluded   out of the race
 * See lib/recognitions/check-rules.ts for the read-time "effective" status.
 */
export type NominationStatus = "draft" | "submitted" | "returned" | "checked" | "excluded";

export type ScoreParams = Partial<Record<"p1" | "p2" | "p3" | "p4" | "p5", number>>;

export type ScoreRow = {
  id: string;
  nomination_id: string;
  evaluator_id: string;
  layer: Layer;
  params: ScoreParams;
  reasons: string[];
  additional_comments: string | null;
  status: "draft" | "submitted";
  submitted_at: string | null;
};

export type Layer1Row = {
  award_id: string;
  chapter_id: string;
  score: number;
  raw: Record<string, unknown>;
  source: "excel" | "manual";
};

export type RankingEntry = {
  nomination_id: string;
  final_score: number | null;
  final_rank: number | null;
};

export type Top3Entry = {
  category: Category;
  rank: 1 | 2 | 3;
  nomination_id: string;
  rationale: string;
  citation: string;
};

export type ModerationVersionRow = {
  id: string;
  award_id: string;
  version: number;
  status: "draft" | "submitted";
  rankings: RankingEntry[];
  top3: Top3Entry[];
  responds_to_decision_id: string | null;
  created_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
};

export type DecisionRow = {
  id: string;
  award_id: string;
  moderation_version_id: string;
  decision: "approve" | "reevaluate";
  reason: string | null;
  decided_by: string;
  decided_at: string;
};

export type CitationEditRow = {
  id: string;
  award_id: string;
  moderation_version_id: string | null;
  category: Category | null;
  rank: number | null;
  field: "citation" | "announcement" | "ceremony_script";
  body: string;
  edited_by: string;
  edited_at: string;
};

export type PredictionRow = {
  id: string;
  award_id: string;
  category: Category;
  predictor_chapter_id: string;
  predicted_chapter_id: string;
  submitted_at: string;
};

/** Uniform action result. Never a silent redirect on a denial. */
export type ActionResult<T = undefined> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string };
