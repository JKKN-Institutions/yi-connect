"use server";

/**
 * YIQ organiser actions.
 *
 * TWO GATES, never mixed:
 *   requireYiqSuperAdmin()  — platform master data: the question bank, papers,
 *                             topics, the edition calendar.
 *   requireYiqEventManage() — anything scoped to ONE chapter event: opening
 *                             and closing the round, computing and publishing
 *                             that chapter's results.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { requireYiqEventManage } from "@/lib/yiq/auth/event-access";
import { shuffle } from "@/lib/yiq/paper";
import {
  assertPoolSafe,
  eligiblePools,
  type PaperKind,
} from "@/lib/yiq/question-pools";
import {
  bestIndividual,
  rankTeams,
  rollUpTeam,
  type MemberResult,
  type TeamRollup,
} from "@/lib/yiq/scoring";

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };
type OkPlain = { success: true };

/**
 * Build a paper by drawing from the active bank, spread evenly across topics.
 * PLATFORM action — a paper is shared national master data, not chapter data.
 */
export async function generatePaper(input: {
  category: "junior" | "senior";
  kind: PaperKind;
  name: string;
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion?: number;
  negativeMarks?: number;
  publish?: boolean;
}): Promise<Ok<{ paperId: string; questionCount: number }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  if (input.questionCount < 1 || input.questionCount > 200) {
    return { success: false, error: "Choose between 1 and 200 questions." };
  }
  if (input.durationMinutes < 1 || input.durationMinutes > 240) {
    return { success: false, error: "Duration must be between 1 and 240 minutes." };
  }

  const svc = await createServiceClient();

  const { data: edition } = await svc
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!edition) return { success: false, error: "No active edition." };

  // POOL SAFETY. The practice pool is public — the sample questions ship in
  // the YIQ deck that circulates to chapters and schools — so a scored paper
  // that drew from it would hand every team that had practised the answers.
  // eligiblePools() returns [] for a kind it does not recognise, and an empty
  // `in` filter would match NOTHING rather than everything, but refuse
  // explicitly rather than relying on that.
  const pools = eligiblePools(input.kind);
  if (pools.length === 0) {
    return {
      success: false,
      error: `Unknown paper kind "${input.kind}" — refusing to build a paper rather than guess which questions it may use.`,
    };
  }
  const unsafe = assertPoolSafe(input.kind, pools);
  if (unsafe) return { success: false, error: unsafe };

  // Eligible pool: active MCQs for this category (or 'both'), restricted to
  // the pools this paper kind may draw from.
  const { data: pool } = await svc
    .from("questions")
    .select("id, topic_id")
    .eq("is_active", true)
    .eq("is_retired", false)
    .eq("question_type", "mcq")
    .in("category", [input.category, "both"])
    .in("pool", pools);

  if (!pool || pool.length === 0) {
    return { success: false, error: "The question bank has no usable questions yet." };
  }
  if (pool.length < input.questionCount) {
    return {
      success: false,
      error: `The bank has only ${pool.length} usable questions for ${input.category}. Add more, or ask for a shorter paper.`,
    };
  }

  // Round-robin across topics so no paper is lopsided towards one topic.
  const byTopic = new Map<string, string[]>();
  for (const q of pool) {
    const list = byTopic.get(q.topic_id) ?? [];
    list.push(q.id);
    byTopic.set(q.topic_id, list);
  }
  for (const [k, v] of byTopic) byTopic.set(k, shuffle(v));

  const topicKeys = shuffle([...byTopic.keys()]);
  const chosen: string[] = [];
  let exhausted = false;
  while (chosen.length < input.questionCount && !exhausted) {
    exhausted = true;
    for (const t of topicKeys) {
      if (chosen.length >= input.questionCount) break;
      const next = byTopic.get(t)?.pop();
      if (next) {
        chosen.push(next);
        exhausted = false;
      }
    }
  }

  const { data: paper, error: paperErr } = await svc
    .from("papers")
    .insert({
      edition_id: edition.id,
      name: input.name.trim(),
      paper_kind: input.kind,
      category: input.category,
      duration_minutes: input.durationMinutes,
      total_questions: chosen.length,
      marks_per_question: input.marksPerQuestion ?? 1,
      negative_marks: input.negativeMarks ?? 0,
      is_published: input.publish ?? false,
      published_at: input.publish ? new Date().toISOString() : null,
      created_by: gate.userId,
    })
    .select("id")
    .single();

  if (paperErr || !paper) {
    console.error("[yiq] paper insert failed", paperErr);
    return { success: false, error: "Could not create the paper." };
  }

  const { error: pqErr } = await svc.from("paper_questions").insert(
    chosen.map((qid, i) => ({
      paper_id: paper.id,
      question_id: qid,
      display_order: i + 1,
    }))
  );
  if (pqErr) {
    console.error("[yiq] paper_questions insert failed", pqErr);
    await svc.from("papers").delete().eq("id", paper.id);
    return { success: false, error: "Could not attach questions to the paper." };
  }

  revalidatePath("/yiq/admin");
  return { success: true, paperId: paper.id, questionCount: chosen.length };
}

/** Publish or unpublish a paper. PLATFORM action. */
export async function setPaperPublished(
  paperId: string,
  published: boolean
): Promise<OkPlain | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const { error } = await svc
    .from("papers")
    .update({
      is_published: published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", paperId);

  if (error) return { success: false, error: "Could not update the paper." };
  revalidatePath("/yiq/admin");
  return { success: true };
}

/** Move a chapter event through its lifecycle. EVENT-SCOPED action. */
export async function setChapterEventStatus(
  chapterEventId: string,
  status:
    | "draft"
    | "registration_open"
    | "registration_closed"
    | "online_round_live"
    | "online_round_closed"
    | "finals_scheduled"
    | "finals_live"
    | "finals_complete"
): Promise<OkPlain | Err> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  // Going live requires a published paper for BOTH categories, or students
  // hit a dead end after their organiser has already told them it is open.
  if (status === "online_round_live") {
    const { data: event } = await svc
      .from("chapter_events")
      .select("edition_id")
      .eq("id", chapterEventId)
      .maybeSingle();

    const { data: papers } = await svc
      .from("papers")
      .select("category")
      .eq("edition_id", event?.edition_id ?? "")
      .eq("paper_kind", "online_round")
      .eq("is_published", true);

    const cats = new Set((papers ?? []).map((p) => p.category));
    const missing = ["junior", "senior"].filter((c) => !cats.has(c));
    if (missing.length > 0) {
      return {
        success: false,
        error: `No published online-round paper for: ${missing.join(", ")}. Ask a YIQ national admin to publish one before going live.`,
      };
    }
  }

  const { error } = await svc
    .from("chapter_events")
    .update({ status })
    .eq("id", chapterEventId);

  if (error) return { success: false, error: "Could not update the event status." };

  await svc.from("audit_log").insert({
    actor_user_id: null,
    action: "chapter_event_status_changed",
    entity_type: "chapter_event",
    entity_id: chapterEventId,
    chapter_event_id: chapterEventId,
    detail: { status, by: gate.access.role },
  });

  revalidatePath(`/yiq/dashboard/${chapterEventId}`);
  return { success: true };
}

export type ComputeResult =
  | (Ok<{ junior: TeamRollup[]; senior: TeamRollup[] }> & {
      bestJunior: MemberResult | null;
      bestSenior: MemberResult | null;
    })
  | Err;

/**
 * Compute the chapter's online-round standings.
 *
 * Read-only against attempts — it writes only the derived rollup onto teams,
 * so it is safe to re-run and always reflects the current attempt data.
 */
export async function computeChapterStandings(
  chapterEventId: string,
  opts: { persist: boolean } = { persist: false }
): Promise<ComputeResult> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("chapter_events")
    .select("id, qualifying_team_count")
    .eq("id", chapterEventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found." };

  const { data: teams } = await svc
    .from("teams")
    .select("id, name, category, status, students(id, full_name)")
    .eq("chapter_event_id", chapterEventId)
    .not("status", "in", "(withdrawn,disqualified)");

  const { data: attempts } = await svc
    .from("attempts")
    .select("student_id, team_id, score, time_taken_seconds, status")
    .eq("chapter_event_id", chapterEventId)
    .eq("is_mock", false)
    .in("status", ["submitted", "auto_submitted"]);

  const byStudent = new Map(
    (attempts ?? []).map((a) => [
      a.student_id,
      {
        score: Number(a.score ?? 0),
        time: a.time_taken_seconds ?? null,
      },
    ])
  );

  const rollups: TeamRollup[] = (teams ?? []).map((t) => {
    const students =
      (t.students as { id: string; full_name: string }[] | null) ?? [];
    const members: MemberResult[] = students.map((s) => {
      const a = byStudent.get(s.id);
      return {
        studentId: s.id,
        studentName: s.full_name,
        score: a?.score ?? 0,
        timeTakenSeconds: a?.time ?? null,
        attempted: Boolean(a),
      };
    });
    return rollUpTeam(t.id, t.name, t.category as "junior" | "senior", members);
  });

  const junior = rankTeams(
    rollups.filter((r) => r.category === "junior"),
    event.qualifying_team_count
  );
  const senior = rankTeams(
    rollups.filter((r) => r.category === "senior"),
    event.qualifying_team_count
  );

  const allJuniorMembers = junior.flatMap((t) => t.members);
  const allSeniorMembers = senior.flatMap((t) => t.members);

  if (opts.persist) {
    for (const t of [...junior, ...senior]) {
      await svc
        .from("teams")
        .update({
          online_total_score: t.totalScore,
          online_rank: t.rank ?? null,
          online_members_attempted: t.membersAttempted,
          status: t.qualified ? "qualified" : "eliminated",
        })
        .eq("id", t.teamId);
    }

    const bj = bestIndividual(allJuniorMembers);
    const bs = bestIndividual(allSeniorMembers);
    await svc
      .from("chapter_events")
      .update({
        best_quizzer_junior_student_id: bj?.studentId ?? null,
        best_quizzer_senior_student_id: bs?.studentId ?? null,
        results_published_at: new Date().toISOString(),
      })
      .eq("id", chapterEventId);

    await svc.from("audit_log").insert({
      action: "standings_published",
      entity_type: "chapter_event",
      entity_id: chapterEventId,
      chapter_event_id: chapterEventId,
      detail: {
        junior_teams: junior.length,
        senior_teams: senior.length,
        junior_qualified: junior.filter((t) => t.qualified).length,
        senior_qualified: senior.filter((t) => t.qualified).length,
      },
    });

    revalidatePath(`/yiq/dashboard/${chapterEventId}`);
  }

  return {
    success: true,
    junior,
    senior,
    bestJunior: bestIndividual(allJuniorMembers),
    bestSenior: bestIndividual(allSeniorMembers),
  };
}
