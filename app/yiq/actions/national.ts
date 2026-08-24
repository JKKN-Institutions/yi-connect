"use server";

/**
 * YIQ Level 2 — the National ladder: Quarter-Finals, Semi-Finals, Final.
 *
 * ONE GATE ONLY: requireYiqSuperAdmin(). The national level is PLATFORM
 * master data — it spans every chapter, so the event-scoped
 * getYiqEventAccess() deliberately does NOT apply here. Never mix the two.
 * Denial always returns { success:false, error }; a national action must
 * never redirect a denied user to a landing page.
 *
 * THE LADDER IS DERIVED. Nothing here assumes a fixed number of stages: the
 * stages that run, and how many teams come out of each, come from
 * nationalLadder() in lib/yiq/national.ts against the live entrant count.
 * Ask for a stage the ladder does not contain and the action refuses.
 *
 * WHERE A STAGE SCORE LIVES. national_entries has columns for only two of the
 * three stages, so finals_scores is the durable per-stage store: one row per
 * team per stage at sequence_no STAGE_TOTAL_SEQUENCE_NO for a typed-in paper
 * total, with live on-stage taps appended from 1 upward by the finals
 * console. semifinal_score/rank and finale_score/rank are then MIRRORED from
 * those totals when those two stages publish, because the columns exist and
 * downstream reporting reads them. The Quarter-Final has no mirror column.
 *
 * This file is "use server" — only async functions and types may be exported.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import type { YiqCategory } from "@/lib/yiq/constants";
import {
  DEFAULT_FINAL_FIELD_SIZE,
  NATIONAL_STAGES,
  STAGE_LABELS,
  STAGE_TOTAL_SEQUENCE_NO,
  clampFinalFieldSize,
  enteringStatuses,
  finalPlacements,
  ladderStep,
  nationalLadder,
  nationalRoundPlan,
  nationalStandings,
  stageField,
  stageOutcomes,
  stagePublished,
  type LadderStep,
  type NationalEntry,
  type NationalEntryStatus,
  type NationalStage,
  type NationalStanding,
} from "@/lib/yiq/national";

type Err = { success: false; error: string };
type OkPlain = { success: true };
type Ok<T> = { success: true } & T;

// finals_scores.points is numeric(6,2): 9999.99 is the ceiling the column
// can physically hold, so validate against it rather than let the insert blow up.
const MAX_STAGE_SCORE = 9999;

const ENTRY_COLUMNS =
  "id, team_id, chapter_name, category, semifinal_score, semifinal_rank, finale_score, finale_rank, status, teams(name)";

export type NationalRoundRow = {
  id: string;
  stage: NationalStage;
  name: string;
  round_number: number;
  round_type: string;
  status: string;
  points_correct: number;
  points_pass_bonus: number;
  time_limit_seconds: number | null;
};

export type StageBoard = {
  stage: NationalStage;
  label: string;
  order: number;
  entering: number;
  advancing: number;
  rounds: NationalRoundRow[];
  /** Teams standing in this stage, ranked on this stage's score. */
  standing: NationalStanding[];
  scoredCount: number;
  /** True once this stage's result has been published. */
  published: boolean;
};

export type NationalBoard = {
  editionId: string;
  editionName: string;
  category: YiqCategory;
  /** Chapter champions entered in this category — what sizes the ladder. */
  entrantCount: number;
  finalFieldSize: number;
  ladder: LadderStep[];
  stages: StageBoard[];
  championTeamId: string | null;
  championTeamName: string | null;
};

/* ------------------------------------------------------------------ read */

/**
 * Everything the national console renders for one category, off the active
 * edition. Read-only, but still gated — the board exposes cross-chapter data.
 */
export async function getNationalBoard(
  category: YiqCategory,
  finalFieldSize: number = DEFAULT_FINAL_FIELD_SIZE
): Promise<Ok<{ board: NationalBoard }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const finalField = clampFinalFieldSize(finalFieldSize);
  const svc = await createServiceClient();

  const { data: edition } = await svc
    .from("editions")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (!edition) {
    return {
      success: false,
      error: "No active YIQ edition. Activate one before running nationals.",
    };
  }

  const [{ data: rawEntries }, { data: rawRounds }] = await Promise.all([
    svc
      .from("national_entries")
      .select(ENTRY_COLUMNS)
      .eq("edition_id", edition.id)
      .eq("category", category),
    svc
      .from("finals_rounds")
      .select(
        "id, stage, name, round_number, round_type, status, points_correct, points_pass_bonus, time_limit_seconds"
      )
      .eq("edition_id", edition.id)
      .eq("category", category)
      .in("stage", NATIONAL_STAGES)
      .order("display_order"),
  ]);

  const entries = (rawEntries ?? []).map(toNationalEntry);
  const rounds = (rawRounds ?? []).map(toRoundRow);
  const ladder = nationalLadder(entries.length, { finalFieldSize: finalField });

  // One scores read for every national round, split per stage below.
  const allRoundIds = rounds.map((r) => r.id);
  const { data: rawScores } = allRoundIds.length
    ? await svc
        .from("finals_scores")
        .select("team_id, points, finals_round_id")
        .in("finals_round_id", allRoundIds)
    : {
        data: [] as {
          team_id: string;
          points: number;
          finals_round_id: string;
        }[],
      };

  const stageOfRound = new Map(rounds.map((r) => [r.id, r.stage]));

  const stages: StageBoard[] = ladder.map((step) => {
    const stageRounds = rounds.filter((r) => r.stage === step.stage);
    const scores = (rawScores ?? [])
      .filter((s) => stageOfRound.get(s.finals_round_id) === step.stage)
      .map((s) => ({ teamId: s.team_id, points: Number(s.points) }));

    // Includes the teams knocked out AT this stage, so a published board
    // still shows the whole field it ranked, not only the survivors.
    const field = stageField(entries, ladder, step.stage);

    // The Final is placed, not cut, so it ranks without a qualifying line.
    const standing = nationalStandings(
      field,
      scores,
      category,
      step.stage === "national_final" ? 0 : step.advancing
    );

    return {
      stage: step.stage,
      label: STAGE_LABELS[step.stage],
      order: step.order,
      entering: step.entering,
      advancing: step.advancing,
      rounds: stageRounds,
      standing,
      scoredCount: standing.filter((s) => s.scored).length,
      published: stagePublished(entries, ladder, step.stage),
    };
  });

  const champion = entries.find((e) => e.status === "national_champion");

  return {
    success: true,
    board: {
      editionId: edition.id,
      editionName: edition.name,
      category,
      entrantCount: entries.length,
      finalFieldSize: finalField,
      ladder,
      stages,
      championTeamId: champion?.teamId ?? null,
      championTeamName: champion?.teamName ?? null,
    },
  };
}

/* ----------------------------------------------------------------- write */

/**
 * Create the rounds for one national stage on the active edition.
 *
 * National rounds live in the same finals_rounds table as the chapter finals,
 * distinguished by `stage` + `edition_id` with a NULL `chapter_event_id` —
 * they belong to the edition, not to any one chapter.
 */
export async function seedNationalRounds(
  category: YiqCategory,
  stage: NationalStage,
  finalFieldSize: number = DEFAULT_FINAL_FIELD_SIZE
): Promise<Ok<{ created: number }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isNationalStage(stage)) {
    return { success: false, error: "That is not a national stage." };
  }

  const svc = await createServiceClient();
  const edition = await activeEditionId(svc);
  if (!edition) return { success: false, error: "No active YIQ edition." };

  const ladder = await ladderFor(svc, edition, category, finalFieldSize);
  const step = ladderStep(ladder, stage);
  if (!step) return { success: false, error: noSuchStageMessage(ladder, stage) };

  const { count } = await svc
    .from("finals_rounds")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", edition)
    .eq("stage", stage)
    .eq("category", category)
    .is("chapter_event_id", null);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `The ${STAGE_LABELS[stage]} rounds already exist for this category.`,
    };
  }

  const plan = nationalRoundPlan(stage);
  const { error } = await svc.from("finals_rounds").insert(
    plan.map((p) => ({
      chapter_event_id: null,
      edition_id: edition,
      stage,
      category,
      round_number: p.roundNumber,
      round_type: p.roundType,
      name: p.name,
      points_correct: p.pointsCorrect,
      points_pass_bonus: p.pointsPassBonus,
      time_limit_seconds: p.timeLimitSeconds,
      questions_per_team: p.questionsPerTeam,
      display_order: p.roundNumber,
    }))
  );

  if (error) {
    console.error("[yiq] seedNationalRounds failed", error);
    return { success: false, error: "Could not create the national rounds." };
  }

  revalidatePath("/yiq/national");
  return { success: true, created: plan.length };
}

/**
 * Record one team's total for one national stage.
 *
 * The Quarter-Final and Semi-Final are written papers, so the number is typed
 * in rather than tapped out. It is stored as a single finals_scores row at
 * STAGE_TOTAL_SEQUENCE_NO, replacing only a previous typed total — live
 * on-stage taps (sequence_no 1 and up) are never touched.
 */
export async function recordStageScore(
  entryId: string,
  stage: NationalStage,
  score: number,
  finalFieldSize: number = DEFAULT_FINAL_FIELD_SIZE
): Promise<OkPlain | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isNationalStage(stage)) {
    return { success: false, error: "That is not a national stage." };
  }
  if (!Number.isFinite(score) || score < 0 || score > MAX_STAGE_SCORE) {
    return {
      success: false,
      error: `Enter a score between 0 and ${MAX_STAGE_SCORE}.`,
    };
  }

  const svc = await createServiceClient();
  const edition = await activeEditionId(svc);
  if (!edition) return { success: false, error: "No active YIQ edition." };

  const { data: entry } = await svc
    .from("national_entries")
    .select("id, edition_id, team_id, category, status")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) return { success: false, error: "That entry does not exist." };
  // FAIL CLOSED: an entry from a past edition is not editable from here.
  if (entry.edition_id !== edition) {
    return { success: false, error: "That entry belongs to a different edition." };
  }
  const cat: YiqCategory = entry.category === "senior" ? "senior" : "junior";
  const ladder = await ladderFor(svc, edition, cat, finalFieldSize);
  const step = ladderStep(ladder, stage);
  if (!step) return { success: false, error: noSuchStageMessage(ladder, stage) };

  const allowed = enteringStatuses(ladder, stage);
  if (!allowed.includes(entry.status as NationalEntryStatus)) {
    return {
      success: false,
      error: `That team is not standing in the ${STAGE_LABELS[stage]}.`,
    };
  }

  const { data: rounds } = await svc
    .from("finals_rounds")
    .select("id")
    .eq("edition_id", edition)
    .eq("category", cat)
    .eq("stage", stage)
    .order("display_order");

  const roundIds = (rounds ?? []).map((r) => r.id);
  if (roundIds.length === 0) {
    return {
      success: false,
      error: `Create the ${STAGE_LABELS[stage]} rounds before recording scores.`,
    };
  }

  // Replace only this team's previous TYPED total for the stage.
  const { error: delErr } = await svc
    .from("finals_scores")
    .delete()
    .eq("team_id", entry.team_id)
    .eq("sequence_no", STAGE_TOTAL_SEQUENCE_NO)
    .in("finals_round_id", roundIds);
  if (delErr) {
    console.error("[yiq] recordStageScore clear failed", delErr);
    return { success: false, error: "Could not replace the previous score." };
  }

  const { error } = await svc.from("finals_scores").insert({
    finals_round_id: roundIds[0],
    team_id: entry.team_id,
    outcome: "correct",
    points: round2(score),
    sequence_no: STAGE_TOTAL_SEQUENCE_NO,
    recorded_by: gate.userId,
  });

  if (error) {
    console.error("[yiq] recordStageScore failed", error);
    return { success: false, error: "Could not save that score." };
  }

  // Mirror onto the column that exists for this stage, if any.
  if (stage === "national_semifinal") {
    await svc
      .from("national_entries")
      .update({ semifinal_score: round2(score) })
      .eq("id", entryId);
  } else if (stage === "national_final") {
    await svc
      .from("national_entries")
      .update({ finale_score: round2(score) })
      .eq("id", entryId);
  }

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    action: "national_stage_score_recorded",
    entity_type: "national_entry",
    entity_id: entryId,
    detail: { stage, category: cat, score: round2(score) },
  });

  revalidatePath("/yiq/national");
  return { success: true };
}

/**
 * Publish one NARROWING stage's result: rank the field on that stage's score,
 * carry the ladder's advancing count through as survivors, eliminate the rest.
 *
 * Refuses while any team in the field is unscored — ranking a half-scored
 * field would eliminate teams for an admin's unfinished data entry rather
 * than for their answers. Teams tied with the last qualifier are carried
 * THROUGH, so the qualifying set may legitimately exceed the ladder's number.
 */
export async function publishStageResults(
  category: YiqCategory,
  stage: NationalStage,
  finalFieldSize: number = DEFAULT_FINAL_FIELD_SIZE
): Promise<
  Ok<{ ranked: number; qualified: number; eliminated: number; tiedAtCut: number }> | Err
> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isNationalStage(stage)) {
    return { success: false, error: "That is not a national stage." };
  }
  if (stage === "national_final") {
    return {
      success: false,
      error: "The Final is decided by crowning a champion, not by publishing a cut.",
    };
  }

  const svc = await createServiceClient();
  const edition = await activeEditionId(svc);
  if (!edition) return { success: false, error: "No active YIQ edition." };

  const { data: rawEntries } = await svc
    .from("national_entries")
    .select(ENTRY_COLUMNS)
    .eq("edition_id", edition)
    .eq("category", category);

  const entries = (rawEntries ?? []).map(toNationalEntry);
  if (entries.length === 0) {
    return {
      success: false,
      error: "No chapter champions have entered this category yet.",
    };
  }

  const ladder = nationalLadder(entries.length, { finalFieldSize });
  const step = ladderStep(ladder, stage);
  if (!step) return { success: false, error: noSuchStageMessage(ladder, stage) };

  const field = stageField(entries, ladder, stage);
  if (field.length === 0) {
    return {
      success: false,
      error: `No team is standing in the ${STAGE_LABELS[stage]} yet.`,
    };
  }

  const scores = await stageScores(svc, edition, category, stage);
  const standing = nationalStandings(field, scores, category, step.advancing);

  const unscored = standing.filter((s) => !s.scored);
  if (unscored.length > 0) {
    return {
      success: false,
      error: `${unscored.length} team${unscored.length === 1 ? " has" : "s have"} no ${STAGE_LABELS[stage]} score yet — record every score before publishing.`,
    };
  }

  const outcomes = stageOutcomes(standing, step);

  for (const o of outcomes) {
    const patch: Record<string, unknown> = { status: o.status };
    // Mirror onto the column that exists for this stage, if any.
    if (stage === "national_semifinal") {
      patch.semifinal_score = o.score;
      patch.semifinal_rank = o.rank;
    }
    const { error } = await svc
      .from("national_entries")
      .update(patch)
      .eq("id", o.entryId);
    if (error) {
      console.error("[yiq] publishStageResults update failed", error);
      return {
        success: false,
        error: `Could not update ${o.teamName}. Some rows may already be published — re-run to finish.`,
      };
    }
  }

  const qualified = outcomes.filter((o) => o.status === step.survivorStatus).length;
  const tied = outcomes.filter((o) => o.tiedAtCut).length;

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    action: "national_stage_published",
    entity_type: "edition",
    entity_id: edition,
    detail: {
      stage,
      category,
      entrants: entries.length,
      ladder: ladder.map((s) => `${s.stage}:${s.entering}->${s.advancing}`),
      ranked: outcomes.length,
      qualified,
      tied_at_cut: tied,
    },
  });

  revalidatePath("/yiq/national");
  return {
    success: true,
    ranked: outcomes.length,
    qualified,
    eliminated: outcomes.length - qualified,
    tiedAtCut: tied,
  };
}

/**
 * Crown the national champion for one category.
 *
 * The Final field's totals are frozen onto finale_score/finale_rank first,
 * then the placement is applied: the crowned team is `national_champion`, the
 * best remaining team (and anyone level with it) is `runner_up`, and everyone
 * else who stood on the stage is `finalist`.
 */
export async function declareNationalChampion(
  category: YiqCategory,
  teamId: string,
  finalFieldSize: number = DEFAULT_FINAL_FIELD_SIZE
): Promise<Ok<{ runnersUp: number; finalists: number }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const edition = await activeEditionId(svc);
  if (!edition) return { success: false, error: "No active YIQ edition." };

  const { data: rawEntries } = await svc
    .from("national_entries")
    .select(ENTRY_COLUMNS)
    .eq("edition_id", edition)
    .eq("category", category);

  const entries = (rawEntries ?? []).map(toNationalEntry);
  const ladder = nationalLadder(entries.length, { finalFieldSize });
  const field = stageField(entries, ladder, "national_final");

  if (field.length === 0) {
    return {
      success: false,
      error:
        "No team has reached the National Final in this category yet — publish the earlier stages first.",
    };
  }
  // FAIL CLOSED: the crown can only go to a team standing in this Final.
  if (!field.some((e) => e.teamId === teamId)) {
    return {
      success: false,
      error: "That team is not standing in this category's National Final.",
    };
  }

  const scores = await stageScores(svc, edition, category, "national_final");
  const standing = nationalStandings(field, scores, category);

  const outcomes = finalPlacements(standing, teamId);
  if (!outcomes) {
    return { success: false, error: "Could not place that Final field." };
  }

  for (const o of outcomes) {
    const { error } = await svc
      .from("national_entries")
      .update({ finale_score: o.score, finale_rank: o.rank, status: o.status })
      .eq("id", o.entryId);
    if (error) {
      console.error("[yiq] declareNationalChampion update failed", error);
      return {
        success: false,
        error: `Could not update ${o.teamName}. Re-run to finish placing the field.`,
      };
    }
  }

  await svc.from("teams").update({ status: "champion" }).eq("id", teamId);

  const runnersUp = outcomes.filter((o) => o.status === "runner_up").length;

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    action: "national_champion_declared",
    entity_type: "team",
    entity_id: teamId,
    detail: {
      category,
      edition_id: edition,
      field: outcomes.length,
      runners_up: runnersUp,
    },
  });

  revalidatePath("/yiq/national");
  return {
    success: true,
    runnersUp,
    finalists: outcomes.filter((o) => o.status === "finalist").length,
  };
}

/* ---------------------------------------------------------------- helpers */

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

async function activeEditionId(svc: ServiceClient): Promise<string | null> {
  const { data } = await svc
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

/** The ladder as the live entrant count sizes it. */
async function ladderFor(
  svc: ServiceClient,
  editionId: string,
  category: YiqCategory,
  finalFieldSize: number
): Promise<LadderStep[]> {
  const { count } = await svc
    .from("national_entries")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId)
    .eq("category", category);
  return nationalLadder(count ?? 0, { finalFieldSize });
}

async function stageScores(
  svc: ServiceClient,
  editionId: string,
  category: YiqCategory,
  stage: NationalStage
): Promise<{ teamId: string; points: number }[]> {
  const { data: rounds } = await svc
    .from("finals_rounds")
    .select("id")
    .eq("edition_id", editionId)
    .eq("category", category)
    .eq("stage", stage);

  const roundIds = (rounds ?? []).map((r) => r.id);
  if (roundIds.length === 0) return [];

  const { data } = await svc
    .from("finals_scores")
    .select("team_id, points")
    .in("finals_round_id", roundIds);

  return (data ?? []).map((s) => ({
    teamId: s.team_id,
    points: Number(s.points),
  }));
}

function noSuchStageMessage(ladder: LadderStep[], stage: NationalStage): string {
  const shape = ladder.map((s) => STAGE_LABELS[s.stage]).join(" → ");
  return `This field runs ${shape || "no stages"}, so there is no ${STAGE_LABELS[stage]}.`;
}

function isNationalStage(stage: string): stage is NationalStage {
  return (NATIONAL_STAGES as string[]).includes(stage);
}

type RawEntry = {
  id: string;
  team_id: string;
  chapter_name: string;
  category: string;
  semifinal_score: number | null;
  semifinal_rank: number | null;
  finale_score: number | null;
  finale_rank: number | null;
  status: string;
  teams: { name: string } | { name: string }[] | null;
};

function toNationalEntry(row: RawEntry): NationalEntry {
  const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
  return {
    entryId: row.id,
    teamId: row.team_id,
    teamName: team?.name ?? "Unnamed team",
    chapterName: row.chapter_name,
    category: row.category === "senior" ? "senior" : "junior",
    semifinalScore:
      row.semifinal_score === null ? null : Number(row.semifinal_score),
    semifinalRank: row.semifinal_rank,
    finaleScore: row.finale_score === null ? null : Number(row.finale_score),
    finaleRank: row.finale_rank,
    status: row.status as NationalEntryStatus,
  };
}

type RawRound = {
  id: string;
  stage: string;
  name: string;
  round_number: number;
  round_type: string;
  status: string;
  points_correct: number;
  points_pass_bonus: number;
  time_limit_seconds: number | null;
};

function toRoundRow(row: RawRound): NationalRoundRow {
  return {
    id: row.id,
    stage: row.stage as NationalStage,
    name: row.name,
    round_number: row.round_number,
    round_type: row.round_type,
    status: row.status,
    points_correct: Number(row.points_correct),
    points_pass_bonus: Number(row.points_pass_bonus),
    time_limit_seconds: row.time_limit_seconds,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
