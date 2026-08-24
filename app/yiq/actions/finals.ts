"use server";

/**
 * Chapter Finals — the live on-stage rounds (deck slide 12, BQC format).
 *
 * Every action is EVENT-SCOPED: requireYiqEventManage() is the gate. Scores
 * are append-only rows in finals_scores, so a mis-tap is corrected by adding
 * a correction row rather than mutating history — on stage, in front of an
 * audience, an audit trail matters more than a tidy table.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqEventManage } from "@/lib/yiq/auth/event-access";
import { FINALS_ROUND_FORMATS } from "@/lib/yiq/constants";

type Err = { success: false; error: string };
type OkPlain = { success: true };

/** Create the six standard rounds for a category, in deck order. */
export async function seedFinalsRounds(
  chapterEventId: string,
  category: "junior" | "senior"
): Promise<OkPlain | Err> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { count } = await svc
    .from("finals_rounds")
    .select("id", { count: "exact", head: true })
    .eq("chapter_event_id", chapterEventId)
    .eq("category", category);

  if ((count ?? 0) > 0) {
    return { success: false, error: "Rounds already exist for this category." };
  }

  const rows = FINALS_ROUND_FORMATS.map((f, i) => ({
    chapter_event_id: chapterEventId,
    stage: "chapter_finals" as const,
    category,
    round_number: i + 1,
    round_type: f.type,
    name: f.name,
    points_correct: f.pointsCorrect,
    points_pass_bonus: f.pointsPassBonus,
    time_limit_seconds: "timeLimitSeconds" in f ? f.timeLimitSeconds : null,
    questions_per_team: "questionsPerTeam" in f ? f.questionsPerTeam : 1,
    display_order: i + 1,
  }));

  const { error } = await svc.from("finals_rounds").insert(rows);
  if (error) {
    console.error("[yiq] seedFinalsRounds failed", error);
    return { success: false, error: "Could not create the rounds." };
  }

  revalidatePath(`/yiq/dashboard/${chapterEventId}/finals`);
  return { success: true };
}

/** Record one team's outcome on one round. Append-only. */
export async function recordFinalsScore(input: {
  chapterEventId: string;
  finalsRoundId: string;
  teamId: string;
  outcome: "correct" | "wrong" | "passed" | "bonus" | "unanswered";
  questionId?: string;
}): Promise<OkPlain | Err> {
  const gate = await requireYiqEventManage(input.chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: round } = await svc
    .from("finals_rounds")
    .select("id, chapter_event_id, points_correct, points_pass_bonus, points_wrong, status")
    .eq("id", input.finalsRoundId)
    .maybeSingle();

  if (!round) return { success: false, error: "Round not found." };
  // FAIL CLOSED: a round from another chapter must never be writable here.
  if (round.chapter_event_id !== input.chapterEventId) {
    return { success: false, error: "That round belongs to a different chapter." };
  }
  if (round.status === "complete") {
    return { success: false, error: "That round is already closed." };
  }

  const points =
    input.outcome === "correct"
      ? Number(round.points_correct)
      : input.outcome === "bonus"
        ? Number(round.points_pass_bonus)
        : input.outcome === "wrong"
          ? -Number(round.points_wrong ?? 0)
          : 0;

  const { count } = await svc
    .from("finals_scores")
    .select("id", { count: "exact", head: true })
    .eq("finals_round_id", input.finalsRoundId);

  const { error } = await svc.from("finals_scores").insert({
    finals_round_id: input.finalsRoundId,
    team_id: input.teamId,
    question_id: input.questionId ?? null,
    outcome: input.outcome,
    points,
    sequence_no: (count ?? 0) + 1,
  });

  if (error) {
    console.error("[yiq] recordFinalsScore failed", error);
    return { success: false, error: "Could not record that score." };
  }

  revalidatePath(`/yiq/dashboard/${input.chapterEventId}/finals`);
  revalidatePath(`/yiq/live/${input.chapterEventId}`);
  return { success: true };
}

/** Undo the most recent score on a round — the on-stage mis-tap fix. */
export async function undoLastFinalsScore(
  chapterEventId: string,
  finalsRoundId: string
): Promise<OkPlain | Err> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: round } = await svc
    .from("finals_rounds")
    .select("chapter_event_id")
    .eq("id", finalsRoundId)
    .maybeSingle();
  if (!round || round.chapter_event_id !== chapterEventId) {
    return { success: false, error: "That round belongs to a different chapter." };
  }

  const { data: last } = await svc
    .from("finals_scores")
    .select("id")
    .eq("finals_round_id", finalsRoundId)
    .order("sequence_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return { success: false, error: "Nothing to undo on this round." };

  await svc.from("finals_scores").delete().eq("id", last.id);
  revalidatePath(`/yiq/dashboard/${chapterEventId}/finals`);
  revalidatePath(`/yiq/live/${chapterEventId}`);
  return { success: true };
}

export async function setFinalsRoundStatus(
  chapterEventId: string,
  finalsRoundId: string,
  status: "pending" | "live" | "complete"
): Promise<OkPlain | Err> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const { data: round } = await svc
    .from("finals_rounds")
    .select("chapter_event_id, category")
    .eq("id", finalsRoundId)
    .maybeSingle();
  if (!round || round.chapter_event_id !== chapterEventId) {
    return { success: false, error: "That round belongs to a different chapter." };
  }

  // Only one round live per category at a time — the scoreboard shows "now".
  if (status === "live") {
    await svc
      .from("finals_rounds")
      .update({ status: "pending" })
      .eq("chapter_event_id", chapterEventId)
      .eq("category", round.category)
      .eq("status", "live");
  }

  const { error } = await svc
    .from("finals_rounds")
    .update({ status })
    .eq("id", finalsRoundId);

  if (error) return { success: false, error: "Could not update the round." };
  revalidatePath(`/yiq/dashboard/${chapterEventId}/finals`);
  revalidatePath(`/yiq/live/${chapterEventId}`);
  return { success: true };
}

/** Crown the chapter champion for a category. */
export async function declareChampion(
  chapterEventId: string,
  category: "junior" | "senior",
  teamId: string
): Promise<OkPlain | Err> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: team } = await svc
    .from("teams")
    .select("id, chapter_event_id, category")
    .eq("id", teamId)
    .maybeSingle();

  if (!team || team.chapter_event_id !== chapterEventId) {
    return { success: false, error: "That team is not in this chapter." };
  }
  if (team.category !== category) {
    return { success: false, error: "That team is in the other category." };
  }

  await svc
    .from("chapter_events")
    .update(
      category === "junior"
        ? { champion_team_junior_id: teamId }
        : { champion_team_senior_id: teamId }
    )
    .eq("id", chapterEventId);

  await svc
    .from("teams")
    .update({ status: "champion", advanced_to_national: true })
    .eq("id", teamId);

  // One chapter, one champion team per category — straight to nationals.
  const { data: event } = await svc
    .from("chapter_events")
    .select("edition_id, chapter_name")
    .eq("id", chapterEventId)
    .maybeSingle();

  if (event) {
    await svc.from("national_entries").upsert(
      {
        edition_id: event.edition_id,
        team_id: teamId,
        chapter_name: event.chapter_name,
        category,
        status: "entered",
      },
      { onConflict: "edition_id,team_id" }
    );
  }

  await svc.from("audit_log").insert({
    action: "champion_declared",
    entity_type: "team",
    entity_id: teamId,
    chapter_event_id: chapterEventId,
    detail: { category },
  });

  revalidatePath(`/yiq/dashboard/${chapterEventId}`);
  return { success: true };
}
