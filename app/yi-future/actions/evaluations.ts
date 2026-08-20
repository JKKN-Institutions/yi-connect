"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import {
  computeTotal,
  type CriteriaScores,
  type Rubric,
} from "@/lib/yi-future/rubric";
import {
  computeMemberTotal,
  isMemberUnscored,
  type MemberScores,
} from "@/lib/yi-future/member-rubric";
import { sendPushToSubject } from "@/lib/yi-future/push";
import { readSession } from "./auth";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";

type EvaluationStatus = Database["future"]["Enums"]["evaluation_status"];

// Tables added after the last `supabase gen types` run are absent from the
// generated types; the established pattern is a loose client at those call
// sites rather than hand-editing types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEvalClient = any;

export type OtherJurorEvalRow = {
  id: string;
  jury_id: string;
  team_id: string;
  event_id: string;
  status: EvaluationStatus | null;
  total_score: number;
  comments: string | null;
  key_strengths: string | null;
  key_gaps: string | null;
  scalability_assessment: string | null;
  policy_relevance: string | null;
  recommendation:
    | "strongly_recommend"
    | "recommend"
    | "not_recommended"
    | null;
  jury_name: string | null;
  archetype: string | null;
};

/**
 * Anti-bias gate [PRD §5.2]:
 * Returns OTHER jurors' submitted evaluations for a team within an event
 * ONLY if the caller's own evaluation for that team+event has status='submitted'.
 * Until the caller submits, returns []. This prevents jurors from anchoring
 * on each other's scores before forming an independent judgement.
 */
export async function getOtherJurorEvalsForTeam(input: {
  juryId: string;
  teamId: string;
  eventId: string;
}): Promise<OtherJurorEvalRow[]> {
  // SECURITY: bind the caller to the juryId they claim. Without this, anyone
  // who knew a juryId that had submitted could read every other juror's
  // scores/comments — a confidentiality breach against the anti-bias design.
  const session = await readSession();
  const isThatJury = session?.type === "jury" && session.id === input.juryId;
  if (!isThatJury) {
    const adminAccess = await resolveFutureAccessOrNull();
    if (!adminAccess?.isNational) return [];
  }

  const svc = await createServiceClient();

  // Gate: caller must have their own submitted eval for this team+event
  const { data: own } = await svc
    .schema("future")
    .from("evaluations")
    .select("id, status")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  const ownRow = own as { id: string; status: EvaluationStatus | null } | null;
  if (!ownRow || ownRow.status !== "submitted") {
    return [];
  }

  // Fetch other jurors' submitted evaluations for the same team+event
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "id, jury_id, team_id, event_id, status, total_score, comments, key_strengths, key_gaps, scalability_assessment, policy_relevance, recommendation, jury_assignments(jury_name, archetype)"
    )
    .eq("team_id", input.teamId)
    .eq("event_id", input.eventId)
    .eq("status", "submitted")
    .neq("jury_id", input.juryId);

  type Row = Omit<OtherJurorEvalRow, "jury_name" | "archetype"> & {
    jury_assignments: { jury_name: string; archetype: string } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    jury_id: r.jury_id,
    team_id: r.team_id,
    event_id: r.event_id,
    status: r.status,
    total_score: r.total_score,
    comments: r.comments,
    key_strengths: r.key_strengths,
    key_gaps: r.key_gaps,
    scalability_assessment: r.scalability_assessment,
    policy_relevance: r.policy_relevance,
    recommendation: r.recommendation,
    jury_name: r.jury_assignments?.jury_name ?? null,
    archetype: r.jury_assignments?.archetype ?? null,
  }));
}

/**
 * Jury-side evaluation save/submit.
 * Uses the mentor/jury access-code session — no Supabase Auth required.
 * Scope must be validated by the caller (jury must be assigned to this team).
 */
// ─── PER-MEMBER SCORES (individual recognition) ─────────────────────
// Field request 2026-08-10. Saved from the same jury screen as the team
// evaluation, but kept in future.member_evaluations and NOT folded into the
// team total — nothing here can move a team's rank.
//
// Identity is bound exactly as saveEvaluation does it: the caller must BE that
// jury (their own access-code session) or a NATIONAL admin, and must be
// assigned to the team. A chapter admin must not be able to inject scores.
export async function saveMemberEvaluations(input: {
  juryId: string;
  teamId: string;
  eventId: string;
  members: { delegateId: string; scores: MemberScores }[];
}): Promise<ActionResult> {
  const session = await readSession();
  const isThatJury = session?.type === "jury" && session.id === input.juryId;
  if (!isThatJury) {
    const adminAccess = await resolveFutureAccessOrNull();
    if (!adminAccess?.isNational) {
      return {
        ok: false,
        error: "You are not authorized to score as this jury member.",
      };
    }
  }

  const svc = await createServiceClient();

  const { data: assign } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .select("team_id")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .maybeSingle();
  if (!assign) {
    return { ok: false, error: "You are not assigned to this team." };
  }

  // Only delegates actually on this team may be scored — the delegate ids
  // arrive from a form and must not be taken on trust.
  const { data: memberRows } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", input.teamId);
  const onTeam = new Set(
    ((memberRows as { delegate_id: string }[] | null) ?? []).map(
      (m) => m.delegate_id
    )
  );

  for (const m of input.members) {
    if (!onTeam.has(m.delegateId)) continue;
    // An untouched member is left absent rather than written as a row of
    // zeros, so "not scored" stays distinguishable from "scored zero".
    if (isMemberUnscored(m.scores)) continue;

    let total: number;
    try {
      total = computeMemberTotal(m.scores);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }

    const { error } = await (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          upsert: (v: unknown, o: unknown) => Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .schema("future")
      .from("member_evaluations")
      .upsert(
        {
          jury_id: input.juryId,
          team_id: input.teamId,
          delegate_id: m.delegateId,
          event_id: input.eventId,
          scores: m.scores,
          total_score: total,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "jury_id,team_id,delegate_id,event_id" }
      );
    if (error) return { ok: false, error: safeError(error.message, "evaluations.saveMemberEvaluations") };
  }

  revalidatePath(`/yi-future/jury/${input.teamId}`);
  return { ok: true };
}

export async function saveEvaluation(input: {
  juryId: string;
  teamId: string;
  eventId: string;
  rubricId: string;
  rubric: Rubric;
  scores: CriteriaScores;
  comments: string | null;
  qaNotes: string | null;
  keyStrengths?: string | null;
  keyGaps?: string | null;
  scalabilityAssessment?: string | null;
  policyRelevance?: string | null;
  recommendation?: "strongly_recommend" | "recommend" | "not_recommended" | null;
  submit: boolean;
}): Promise<ActionResult> {
  // SECURITY: the caller must BE the jury they claim to be. Previously this
  // accepted any caller-supplied juryId and only checked that a jury_team
  // assignment row existed — so anyone who knew a juryId UUID could submit or
  // overwrite scores for any team. Bind identity two ways:
  //   1. The jury access-code session (cookie) whose id === input.juryId, OR
  //   2. A Yi Future admin (unlock / corrections on behalf of a jury).
  const session = await readSession();
  const isThatJury =
    session?.type === "jury" && session.id === input.juryId;
  if (!isThatJury) {
    // Admin override (unlock / corrections) is NATIONAL-ONLY. A chapter chair
    // must not inject or overwrite scores — that would let chapter A's admin
    // tamper with chapter B's jury results. The legitimate scorer is the jury
    // via their own session above.
    const adminAccess = await resolveFutureAccessOrNull();
    const isAdmin = !!adminAccess && adminAccess.isNational;
    if (!isAdmin) {
      return {
        ok: false,
        error: "You are not authorized to score as this jury member.",
      };
    }
  }

  // Validate jury-team assignment (conflict check)
  const svc = await createServiceClient();
  const { data: assign } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .select("team_id")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .maybeSingle();
  if (!assign) {
    return { ok: false, error: "You are not assigned to this team." };
  }

  // Compute total with range validation (throws on out-of-range)
  let total: number;
  try {
    total = computeTotal(input.scores, input.rubric);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Upsert by unique (event_id, jury_id, team_id) — enforce one eval per jury per team per event
  // The schema doesn't declare this unique index in types here; rely on manual select-first:
  const { data: existing } = await svc
    .schema("future")
    .from("evaluations")
    .select("id, status")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  const ex = existing as { id: string; status: EvaluationStatus | null } | null;

  if (ex?.status === "submitted") {
    return {
      ok: false,
      error: "Evaluation already submitted. Ask admin to unlock if needed.",
    };
  }

  const status: EvaluationStatus = input.submit ? "submitted" : "draft";
  const payload = {
    jury_id: input.juryId,
    team_id: input.teamId,
    event_id: input.eventId,
    rubric_id: input.rubricId,
    criteria_scores: input.scores,
    total_score: total,
    comments: input.comments,
    q_and_a_notes: input.qaNotes,
    key_strengths: input.keyStrengths ?? null,
    key_gaps: input.keyGaps ?? null,
    scalability_assessment: input.scalabilityAssessment ?? null,
    policy_relevance: input.policyRelevance ?? null,
    recommendation: input.recommendation ?? null,
    status,
    submitted_at: input.submit ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  } as never;

  let evaluationId: string;
  if (ex) {
    const { error } = await svc
      .schema("future")
      .from("evaluations")
      .update(payload)
      .eq("id", ex.id);
    if (error) return { ok: false, error: safeError(error.message, "evaluations.saveEvaluation") };
    evaluationId = ex.id;
  } else {
    const { data: ins, error } = await svc
      .schema("future")
      .from("evaluations")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: safeError(error.message, "evaluations.saveEvaluation") };
    evaluationId = (ins as { id: string } | null)?.id ?? "";
  }

  // Audit trail
  if (evaluationId) {
    await svc
      .schema("future")
      .from("evaluation_audit_log")
      .insert({
        evaluation_id: evaluationId,
        new_scores: input.scores,
        new_total: total,
        reason: input.submit ? "submit" : "save_draft",
      });
  }

  revalidatePath("/yi-future/jury");
  revalidatePath(`/yi-future/jury/${input.teamId}`);
  revalidatePath("/yi-future/chapter/scoring");
  revalidatePath("/yi-future/chapter/results");

  // Fire-and-forget push to team captain on submit
  if (input.submit && evaluationId) {
    try {
      const { data: team } = await (svc as any)
        .schema("future")
        .from("teams")
        .select("captain_id")
        .eq("id", input.teamId)
        .maybeSingle();
      const captainId = (team as { captain_id: string | null } | null)
        ?.captain_id;
      if (captainId) {
        await sendPushToSubject("delegate", captainId, {
          title: "Jury evaluation submitted",
          body: "A jury has submitted scores for your team.",
          url: "/me/results",
        });
      }
    } catch (err) {
      console.error("[push] saveEvaluation notify captain failed:", err);
    }
  }

  // On successful submit, redirect back to the jury dashboard with a
  // success flag so the chair sees confirmation and cannot duplicate-submit.
  // Note: redirect() throws, so it must be after all DB writes/notifications.
  if (input.submit) {
    redirect("/yi-future/jury?submitted=1");
  }

  return {
    ok: true,
    message: "Draft saved.",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// REOPEN A SUBMITTED EVALUATION
//
// saveEvaluation() refuses to overwrite an evaluation once status =
// 'submitted', and the sentence it returns is "Evaluation already submitted.
// Ask admin to unlock if needed." No unlock existed — not for a chapter admin,
// not for a national admin, nowhere in the codebase. A juror who mis-tapped a
// slider and pressed Submit had made a permanent wrong score, and since these
// scores decide the awards, the only remedy was editing the database by hand.
//
// FOUR PROPERTIES
//
// 1. THE SCORES ARE LEFT ALONE. Only `status` and `submitted_at` change. The
//    juror reopens the form with their numbers exactly where they left them and
//    corrects the one that was wrong, rather than re-entering six from memory
//    under time pressure — which is its own chance to introduce a new mistake.
//
// 2. THE RECORD IS WRITTEN FIRST. A row goes into the EXISTING
//    future.evaluation_audit_log before the status flips, and if that insert
//    fails NOTHING is reopened. An unlock that cannot be recorded does not
//    happen. No new table: that log is already this codebase's home for
//    changes to a scorecard.
//
// 3. SCOPED TO THE CALLER'S OWN CHAPTER, and it fails CLOSED. A chapter admin
//    may reopen scores for their own chapter's teams only. Note this does NOT
//    let them change a score: saveEvaluation still requires the juror's own
//    session (or a national admin), so the only person who can enter a new
//    number is the juror themselves. Unlock hands the form back; it does not
//    hand over the pen.
//
// 4. IT DENIES EXPLICITLY. Every refusal returns a sentence, never a silent
//    redirect to a dashboard.
// ═══════════════════════════════════════════════════════════════════════

/** Reopen one submitted evaluation so its juror can correct it. */
export async function unlockEvaluation(input: {
  evaluationId: string;
  reason?: string;
}): Promise<ActionResult> {
  const access = await resolveFutureAccessOrNull();
  if (!access) {
    return {
      ok: false,
      error: "Nothing was reopened. You are not signed in as a Yi Future admin.",
    };
  }

  if (!input.evaluationId) {
    return { ok: false, error: "Nothing was reopened. No score was named." };
  }

  const reason = (input.reason ?? "").trim();
  if (reason.length > 500) {
    return {
      ok: false,
      error: `Nothing was reopened. The reason is ${reason.length} characters; keep it under 500 so it fits in the record.`,
    };
  }

  const svc = await createServiceClient();
  // future.evaluation_audit_log is not in the generated types (as with every
  // table added after the last regen) → loose client for those statements.
  const loose = svc as AnyEvalClient;

  // ─── Load the evaluation, and the team it belongs to ──────────────────
  const { data: evRaw } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "id, status, total_score, criteria_scores, jury_id, team_id, teams!inner(id, team_name, chapter_id, edition_id)"
    )
    .eq("id", input.evaluationId)
    .maybeSingle();

  const ev = evRaw as unknown as {
    id: string;
    status: string | null;
    total_score: number | null;
    criteria_scores: CriteriaScores | null;
    jury_id: string;
    team_id: string;
    teams: {
      id: string;
      team_name: string;
      chapter_id: string | null;
      edition_id: string | null;
    } | null;
  } | null;

  if (!ev || !ev.teams) {
    return {
      ok: false,
      error:
        "Nothing was reopened. That score no longer exists — reload this page.",
    };
  }

  const chapterId = ev.teams.chapter_id;
  const editionId = ev.teams.edition_id;

  // ─── Gate: own chapter only, national may reach in. Fails CLOSED ──────
  // A null chapter denies rather than skipping the check.
  const isOwnChapter = !!chapterId && access.chapterIds.includes(chapterId);
  if (!access.isNational && !isOwnChapter) {
    return {
      ok: false,
      error:
        "Nothing was reopened. You can only reopen scores for your own chapter's teams.",
    };
  }
  if (!chapterId || !editionId) {
    return {
      ok: false,
      error:
        "Nothing was reopened. That team is not attached to a chapter and edition.",
    };
  }

  // ─── Only a SUBMITTED score can be reopened ───────────────────────────
  if (ev.status !== "submitted") {
    return {
      ok: false,
      error:
        ev.status === "draft"
          ? "Nothing was reopened. That score is already open — the juror can still edit it."
          : `Nothing was reopened. That score is "${ev.status ?? "unknown"}", not submitted.`,
    };
  }

  // ─── Snapshots for the record ─────────────────────────────────────────
  const { data: juryRaw } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("jury_name")
    .eq("id", ev.jury_id)
    .maybeSingle();
  const juryName = (juryRaw as { jury_name: string | null } | null)?.jury_name ?? null;

  const actor = await describeUnlockActor(access.userId);

  // ─── 1. THE RECORD, BEFORE THE REOPEN ─────────────────────────────────
  // future.evaluation_audit_log is the table this codebase already has for
  // changes to a scorecard. Reusing it rather than adding a parallel unlock
  // table: one history per evaluation, one place to read it.
  //
  // previous_* and new_* are deliberately IDENTICAL here — a reopen does not
  // change any number, it only makes them editable again. The pair records
  // what the score stood at when it was reopened, which is the question an
  // award dispute actually asks.
  //
  // If this insert fails, nothing is reopened. A reopen that cannot be
  // recorded must not happen.
  const { data: recRaw, error: recErr } = await loose
    .schema("future")
    .from("evaluation_audit_log")
    .insert({
      evaluation_id: ev.id,
      previous_scores: ev.criteria_scores,
      new_scores: ev.criteria_scores,
      previous_total: ev.total_score,
      new_total: ev.total_score,
      changed_by: [
        actor.name ?? actor.email ?? access.userId,
        access.isNational && !isOwnChapter ? "(national admin)" : "(chapter admin)",
      ].join(" "),
      reason: [
        `REOPENED ${juryName ?? "juror"}'s scorecard for ${ev.teams.team_name}`,
        reason.length > 0 ? `— ${reason}` : "— no reason given",
      ].join(" "),
    })
    .select("id")
    .maybeSingle();

  if (recErr) {
    return {
      ok: false,
      error: `Nothing was reopened. The score history could not be written, and a reopen that cannot be recorded must not happen. (${
        recErr.message ?? "unknown error"
      })`,
    };
  }
  if (!(recRaw as { id: string } | null)?.id) {
    return {
      ok: false,
      error:
        "Nothing was reopened. The score history took the entry but did not confirm it. Reload this page before trying again.",
    };
  }

  // ─── 2. THE REOPEN ────────────────────────────────────────────────────
  // Only status and submitted_at. criteria_scores, the comments and the
  // per-member recognition scores are all left exactly as the juror left them.
  const { error: updErr } = await loose
    .schema("future")
    .from("evaluations")
    .update({ status: "draft", submitted_at: null })
    .eq("id", ev.id)
    .eq("status", "submitted");

  if (updErr) {
    return {
      ok: false,
      error: `The reopen was recorded but did NOT take effect: ${
        updErr.message ?? "the database refused the change"
      }. The score is still submitted. Reload this page.`,
    };
  }

  revalidatePath("/yi-future/chapter/scoring");
  revalidatePath("/yi-future/chapter/results");
  revalidatePath("/yi-future/jury");
  revalidatePath(`/yi-future/jury/${ev.team_id}`);

  return {
    ok: true,
    message: `${
      juryName ?? "That juror"
    }'s score for ${ev.teams.team_name} is open again. Their numbers are still there — ask them to correct what is wrong and submit again.`,
  };
}

/**
 * Best-effort name/email for the admin doing the reopen, snapshotted into the
 * record. Never throws and never blocks the unlock: an unnamed record is still
 * a record.
 */
async function describeUnlockActor(
  userId: string
): Promise<{ name: string | null; email: string | null }> {
  try {
    const svc = await createServiceClient();
    // yi_directory is the canonical identity spine and is not in the generated
    // future types → loose client, the established cross-schema pattern.
    const { data } = await (svc as AnyEvalClient)
      .schema("yi_directory")
      .from("people")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    const p = data as { full_name: string | null; email: string | null } | null;
    return { name: p?.full_name ?? null, email: p?.email ?? null };
  } catch {
    return { name: null, email: null };
  }
}
