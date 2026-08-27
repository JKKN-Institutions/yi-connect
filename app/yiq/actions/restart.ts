"use server";

/**
 * The ONE restart a chapter organiser may grant a student.
 *
 * THE SHAPE OF IT (Director, 2026-08-25). A student's phone dies mid-paper,
 * their time runs out, the paper closes. The organiser may hand back — once,
 * ever — exactly the time that was left, on the SAME paper, with the SAME
 * question order and the answers they had already saved. It is a resume, not
 * a re-sit.
 *
 * THREE THINGS THIS FILE IS CAREFUL ABOUT
 *
 *  1. AUTHORITY. Every entry point re-reads the attempt server-side and gates
 *     on the attempt's OWN chapter event via requireYiqEventManage(). A
 *     client never names the event it wants permission for. Failures return
 *     { success: false, error } — never a redirect, which would produce an
 *     undiagnosable bounce loop.
 *
 *  2. TIME. The minutes handed back are computed by lib/yiq/restart.ts from
 *     the original attempt row. No number from a client is ever trusted, and
 *     an attempt that used its whole clock gets an explicit refusal rather
 *     than a silent full paper.
 *
 *  3. ONCE. yiq.attempt_restarts carries a UNIQUE index on (student_id), so
 *     "one restart, ever" survives two organisers clicking at the same
 *     instant: the loser's insert raises 23505 and is reported as the grant
 *     that already exists. The consume step is equally once-only — it is a
 *     conditional UPDATE on `consumed_at is null`.
 *
 * WHEN THE CLOCK STARTS. On the STUDENT's next start, not on the grant.
 * consumeGrantedRestart() is called from startAttempt(); otherwise the eight
 * minutes they were given would drain while they looked for a charger.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqEventManage } from "@/lib/yiq/auth/event-access";
import { requireStudentSession } from "@/lib/yiq/auth/yiq-session";
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import {
  canRestart,
  computeRemainingMs,
  formatDuration,
  restartTimestamps,
  validateReason,
  REFUSAL_TEXT,
  type RestartAttempt,
  type RestartRefusal,
} from "@/lib/yiq/restart";

const ATTEMPT_COLUMNS =
  "id, student_id, team_id, chapter_event_id, is_mock, status, started_at, expires_at, submitted_at, score, question_order";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * `yiq.attempt_restarts` (supabase/migrations/yiq_12_attempt_restarts.sql).
 * Fully typed since the schema was applied and types/yiq/database.ts was
 * regenerated on 2026-08-27 — the temporary `as any` escape hatch this
 * function used to hold is gone. Kept as a one-line helper only so the four
 * call sites read the same way.
 */
function restarts(svc: ServiceClient) {
  return svc.from("attempt_restarts");
}

type GrantRow = {
  id: string;
  attempt_id: string;
  student_id: string;
  granted_ms: number;
  reason: string;
  granted_by_label: string | null;
  granted_at: string;
  consumed_at: string | null;
};

type AttemptRow = {
  id: string;
  student_id: string;
  team_id: string | null;
  chapter_event_id: string | null;
  is_mock: boolean;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  score: number | string | null;
  question_order: string[] | null;
};

function toRestartAttempt(
  a: AttemptRow,
  lastAnsweredAt: string | null
): RestartAttempt {
  return {
    id: a.id,
    isMock: a.is_mock,
    status: a.status,
    startedAt: a.started_at,
    expiresAt: a.expires_at,
    submittedAt: a.submitted_at,
    lastAnsweredAt,
  };
}

/**
 * `max(attempt_answers.answered_at)` for each attempt — the clock the whole
 * restart decision is made on (see lib/yiq/restart.ts computeRemainingMs for
 * why NOT `submitted_at`).
 *
 * Goes through the `yiq.attempt_last_answered` aggregate rather than reading
 * answer rows: the organiser's panel asks about up to 1000 attempts at once,
 * which is ~30,000 answer rows, over PostgREST's row cap — and that cap
 * TRUNCATES SILENTLY. A truncated read would look like "this student never
 * answered anything", which computeRemainingMs correctly treats as "they got
 * nowhere" and would pay out a FULL paper. Aggregating server-side returns
 * one bounded row per attempt, so there is nothing to truncate.
 *
 * Returns `null` on failure — NEVER an empty map. Callers must fail closed:
 * an empty map is indistinguishable from "nobody answered anything", which
 * is the maximum-payout answer. This is the one read in this file where
 * degrading gracefully would hand out free time.
 */
async function fetchLastAnswered(
  svc: ServiceClient,
  attemptIds: string[]
): Promise<Map<string, string> | null> {
  if (attemptIds.length === 0) return new Map();

  const { data, error } = await svc.rpc("attempt_last_answered", {
    p_attempt_ids: attemptIds,
  });

  if (error) {
    console.error("[yiq] attempt_last_answered failed", error);
    return null;
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.last_answered_at) map.set(row.attempt_id, row.last_answered_at);
  }
  return map;
}

/** The fail-closed message for a lost last-answer read. One wording, one place. */
const LAST_ANSWERED_UNREADABLE =
  "Could not work out when these papers actually stopped, so the time owed cannot be calculated safely. Try again in a moment.";

// ---------------------------------------------------------------------
// The organiser's list
// ---------------------------------------------------------------------

export type RestartCandidate = {
  attemptId: string;
  studentId: string;
  studentName: string;
  schoolName: string | null;
  teamName: string | null;
  category: string | null;
  status: string;
  score: number;
  /** Milliseconds that were left when the paper stopped. 0 when none. */
  remainingMs: number;
  remainingLabel: string;
  eligible: boolean;
  /** Machine-readable refusal, null when eligible. */
  refusal: RestartRefusal | null;
  refusalText: string | null;
  /** Set when this student has already had their one restart. */
  grant: {
    grantedMs: number;
    grantedLabel: string;
    reason: string;
    grantedBy: string | null;
    grantedAt: string;
    consumedAt: string | null;
  } | null;
};

export type ListRestartCandidatesResult =
  | { success: true; candidates: RestartCandidate[] }
  | { success: false; error: string };

/**
 * Every real attempt in this chapter event that an organiser might need to
 * act on: the ones whose paper closed on them, and the ones already granted
 * a restart (so the panel can show what was done and by whom).
 *
 * Deliberately NOT filtered down to only the eligible ones — an organiser
 * standing in front of a distressed student needs to see the student's name
 * and the REASON the answer is no, not an empty list.
 */
export async function listRestartCandidates(
  chapterEventId: string
): Promise<ListRestartCandidatesResult> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: attempts, error } = await svc
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("chapter_event_id", chapterEventId)
    .eq("is_mock", false)
    .in("status", ["submitted", "auto_submitted", "disqualified"])
    .order("submitted_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[yiq] listRestartCandidates query failed", error);
    return { success: false, error: "Could not read this chapter's papers." };
  }

  const rows = (attempts ?? []) as AttemptRow[];
  if (rows.length === 0) return { success: true, candidates: [] };

  const studentIds = [...new Set(rows.map((a) => a.student_id))];

  // `category` lives on teams, not students — a student's category is their
  // team's. Reading it off the student row would silently be undefined.
  const [{ data: students }, { data: grants, error: grantsErr }] = await Promise.all([
    svc
      .from("students")
      .select("id, full_name, teams(name, category, schools(name))")
      .in("id", studentIds),
    restarts(svc)
      .select(
        "id, attempt_id, student_id, granted_ms, reason, granted_by_label, granted_at, consumed_at"
      )
      .in("student_id", studentIds),
  ]);

  // FAIL CLOSED, LOUDLY. A failed grants read (missing migration, a bad
  // grant, a transient error) would leave `alreadyRestarted` false for every
  // student and this screen would offer a restart to people who have already
  // had one. The unique index would still refuse the write, but the organiser
  // would have been told a lie first — so refuse to render the list at all.
  if (grantsErr) {
    console.error("[yiq] listRestartCandidates grants read failed", grantsErr);
    return {
      success: false,
      error:
        "Could not read which students have already had a restart, so this list is not safe to show. Try again in a moment.",
    };
  }

  type StudentRow = {
    id: string;
    full_name: string | null;
    teams: {
      name: string | null;
      category: string | null;
      schools: { name: string | null } | null;
    } | null;
  };
  const studentById = new Map(
    ((students ?? []) as unknown as StudentRow[]).map((s) => [s.id, s])
  );

  const grantByStudent = new Map(
    ((grants ?? []) as GrantRow[]).map((g) => [g.student_id, g])
  );

  // FAIL CLOSED, same posture as the grants read above: without this, every
  // student looks like they answered nothing and the panel would offer each
  // of them a full paper.
  const lastAnswered = await fetchLastAnswered(
    svc,
    rows.map((a) => a.id)
  );
  if (lastAnswered === null) {
    return { success: false, error: LAST_ANSWERED_UNREADABLE };
  }

  const candidates: RestartCandidate[] = rows.map((a) => {
    const grant = grantByStudent.get(a.student_id) ?? null;
    const shaped = toRestartAttempt(a, lastAnswered.get(a.id) ?? null);
    const decision = canRestart(shaped, {
      alreadyRestarted: Boolean(grant),
    });
    const remainingMs = computeRemainingMs(shaped) ?? 0;
    const s = studentById.get(a.student_id);

    return {
      attemptId: a.id,
      studentId: a.student_id,
      studentName: s?.full_name ?? "Unnamed student",
      schoolName: s?.teams?.schools?.name ?? null,
      teamName: s?.teams?.name ?? null,
      category: s?.teams?.category ?? null,
      status: a.status,
      score: Number(a.score ?? 0),
      remainingMs,
      remainingLabel: formatDuration(remainingMs),
      eligible: decision.ok,
      refusal: decision.ok ? null : decision.reason,
      refusalText: decision.ok ? null : REFUSAL_TEXT[decision.reason],
      grant: grant
        ? {
            grantedMs: grant.granted_ms,
            grantedLabel: formatDuration(grant.granted_ms),
            reason: grant.reason,
            grantedBy: grant.granted_by_label,
            grantedAt: grant.granted_at,
            consumedAt: grant.consumed_at,
          }
        : null,
    };
  });

  // Eligible first (that is what the organiser came to do), then the ones
  // already granted, then the refusals.
  const rank = (c: RestartCandidate) => (c.eligible ? 0 : c.grant ? 1 : 2);
  candidates.sort(
    (x, y) => rank(x) - rank(y) || x.studentName.localeCompare(y.studentName)
  );

  return { success: true, candidates };
}

// ---------------------------------------------------------------------
// The grant
// ---------------------------------------------------------------------

export type GrantRestartResult =
  | {
      success: true;
      grantedMs: number;
      grantedLabel: string;
      /** True when this exact grant already existed — the call was a no-op. */
      alreadyGranted: boolean;
    }
  | { success: false; error: string; refusal?: RestartRefusal };

/**
 * Grant the one restart. Records WHO, WHY and HOW MUCH, permanently.
 *
 * Idempotent by construction: the unique index on (student_id) means a second
 * grant — a double click, two organisers, a retried request — returns the
 * first one instead of creating another.
 */
export async function grantRestart(input: {
  attemptId: string;
  reason: string;
}): Promise<GrantRestartResult> {
  const svc = await createServiceClient();

  // Read the attempt FIRST: the event to authorise against comes from the
  // row, never from the caller.
  const { data: raw } = await svc
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("id", input.attemptId)
    .maybeSingle();

  const attempt = raw as AttemptRow | null;
  if (!attempt) return { success: false, error: "That paper was not found." };

  if (!attempt.chapter_event_id) {
    // No event means no scope to authorise against. Fail closed.
    return {
      success: false,
      error: "That paper is not attached to a chapter event, so it cannot be restarted.",
    };
  }

  const gate = await requireYiqEventManage(attempt.chapter_event_id);
  if (!gate.ok) return { success: false, error: gate.error };

  const reasonError = validateReason(input.reason);
  if (reasonError) return { success: false, error: reasonError };
  const reason = input.reason.trim();

  // Has this student already had their one? (The unique index is what makes
  // this true under a race; this read is for the friendly message.)
  const { data: existing } = (await restarts(svc)
    .select("id, granted_ms")
    .eq("student_id", attempt.student_id)
    .maybeSingle()) as { data: Pick<GrantRow, "id" | "granted_ms"> | null };

  const lastAnswered = await fetchLastAnswered(svc, [attempt.id]);
  if (lastAnswered === null) {
    return { success: false, error: LAST_ANSWERED_UNREADABLE };
  }

  const decision = canRestart(
    toRestartAttempt(attempt, lastAnswered.get(attempt.id) ?? null),
    { alreadyRestarted: Boolean(existing) }
  );

  if (!decision.ok) {
    if (decision.reason === "already_restarted" && existing) {
      return {
        success: true,
        grantedMs: existing.granted_ms,
        grantedLabel: formatDuration(existing.granted_ms),
        alreadyGranted: true,
      };
    }
    return {
      success: false,
      error: REFUSAL_TEXT[decision.reason],
      refusal: decision.reason,
    };
  }

  const roles = await getCurrentPersonRoles();

  const { error: insertErr } = (await restarts(svc).insert({
    attempt_id: attempt.id,
    student_id: attempt.student_id,
    chapter_event_id: attempt.chapter_event_id,
    granted_ms: decision.grantedMs,
    reason,
    granted_by_user_id: roles?.user_id ?? null,
    granted_by_label: roles?.email ?? gate.access.role,
  })) as { error: { code?: string } | null };

  if (insertErr) {
    // 23505 — someone else granted it between our read and our write. That is
    // the index doing its job; report the grant that exists.
    if (insertErr.code === "23505") {
      const { data: won } = (await restarts(svc)
        .select("granted_ms")
        .eq("student_id", attempt.student_id)
        .maybeSingle()) as { data: Pick<GrantRow, "granted_ms"> | null };
      return {
        success: true,
        grantedMs: won?.granted_ms ?? decision.grantedMs,
        grantedLabel: formatDuration(won?.granted_ms ?? decision.grantedMs),
        alreadyGranted: true,
      };
    }
    console.error("[yiq] grantRestart insert failed", insertErr);
    return { success: false, error: "Could not record the restart. Please retry." };
  }

  await svc.from("audit_log").insert({
    actor_user_id: roles?.user_id ?? null,
    actor_label: roles?.email ?? null,
    action: "attempt_restart_granted",
    entity_type: "attempt",
    entity_id: attempt.id,
    chapter_event_id: attempt.chapter_event_id,
    detail: {
      student_id: attempt.student_id,
      granted_ms: decision.grantedMs,
      used_ms: decision.usedMs,
      duration_ms: decision.durationMs,
      original_status: attempt.status,
      by_role: gate.access.role,
      reason,
    },
  });

  console.log(
    JSON.stringify({
      tag: "yiq_restart",
      verdict: "granted",
      attemptId: attempt.id,
      studentId: attempt.student_id,
      chapterEventId: attempt.chapter_event_id,
      grantedMs: decision.grantedMs,
    })
  );

  revalidatePath(`/yiq/dashboard/${attempt.chapter_event_id}`);

  return {
    success: true,
    grantedMs: decision.grantedMs,
    grantedLabel: formatDuration(decision.grantedMs),
    alreadyGranted: false,
  };
}

// ---------------------------------------------------------------------
// The student's side — spending the grant
// ---------------------------------------------------------------------

export type ConsumeRestartResult =
  | { resumed: true; expiresAt: string; grantedMs: number }
  | { resumed: false };

/**
 * Spend an unspent grant and reopen the attempt. Called by startAttempt()
 * when a student whose paper is closed comes back — so the clock starts when
 * they actually return.
 *
 * SAFE TO CALL FROM ANYWHERE. It is gated on the student's own signed
 * session and on owning the attempt, and its only effect is the one the
 * organiser already authorised. Calling it twice does nothing the second
 * time: the grant is claimed with a conditional UPDATE on
 * `consumed_at is null`, so only one caller can ever win it.
 */
export async function consumeGrantedRestart(
  attemptId: string
): Promise<ConsumeRestartResult> {
  const session = await requireStudentSession();
  if (!session.ok) return { resumed: false };

  const svc = await createServiceClient();

  const { data: raw } = await svc
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("id", attemptId)
    .maybeSingle();

  const attempt = raw as AttemptRow | null;
  if (!attempt) return { resumed: false };
  if (attempt.student_id !== session.session.id) return { resumed: false };

  const { data: grant } = (await restarts(svc)
    .select("id, granted_ms, consumed_at")
    .eq("attempt_id", attemptId)
    .is("consumed_at", null)
    .maybeSingle()) as {
    data: Pick<GrantRow, "id" | "granted_ms" | "consumed_at"> | null;
  };

  if (!grant) return { resumed: false };

  // The decision is re-derived from the attempt, not read off the grant: the
  // grant says a restart was authorised, the attempt says how much time it is
  // worth. `alreadyRestarted` is false here because this IS that restart.
  //
  // A lost last-answer read refuses the resume rather than guessing. The
  // grant is NOT consumed, so the student can try again in a moment and
  // still has their one restart.
  const lastAnswered = await fetchLastAnswered(svc, [attempt.id]);
  if (lastAnswered === null) {
    console.log(
      JSON.stringify({
        tag: "yiq_restart",
        verdict: "consume_refused",
        attemptId,
        reason: "last_answered_unreadable",
      })
    );
    return { resumed: false };
  }

  const decision = canRestart(
    toRestartAttempt(attempt, lastAnswered.get(attempt.id) ?? null),
    { alreadyRestarted: false }
  );
  if (!decision.ok) {
    console.log(
      JSON.stringify({
        tag: "yiq_restart",
        verdict: "consume_refused",
        attemptId,
        reason: decision.reason,
      })
    );
    return { resumed: false };
  }

  // Never hand back more than was granted, even if the attempt row changed.
  const grantedMs = Math.min(decision.grantedMs, grant.granted_ms);
  if (grantedMs <= 0) return { resumed: false };

  // THE ROUND'S CLOSING TIME IS A HARD CEILING (Director ruling, 2026-08-27).
  // A student whose phone died keeps every minute they were owed right up to
  // the bell, but not past it — the round closes for everyone at the same
  // moment and the standings are computed from it. Read from the event rather
  // than trusted from anywhere else.
  let roundClosesAtMs: number | null = null;
  if (attempt.chapter_event_id) {
    const { data: ev } = await svc
      .from("chapter_events")
      .select("online_round_closes_at")
      .eq("id", attempt.chapter_event_id)
      .maybeSingle();
    const parsed = ev?.online_round_closes_at
      ? Date.parse(ev.online_round_closes_at)
      : NaN;
    if (Number.isFinite(parsed)) roundClosesAtMs = parsed;
  }

  const stamps = restartTimestamps(
    { ...decision, grantedMs },
    Date.now(),
    roundClosesAtMs
  );

  // Under a minute left before the bell. Do NOT consume the grant — the
  // student keeps their one restart rather than spending it on forty
  // seconds they cannot use.
  if (stamps === null) {
    console.log(
      JSON.stringify({
        tag: "yiq_restart",
        verdict: "consume_refused",
        attemptId,
        reason: "too_close_to_round_close",
      })
    );
    return { resumed: false };
  }

  if (stamps.clampedByRoundClose) {
    console.log(
      JSON.stringify({
        tag: "yiq_restart",
        verdict: "resumed_clamped",
        attemptId,
        grantedMs,
        newExpiresAt: stamps.expiresAt,
      })
    );
  }

  // CLAIM FIRST. Whoever flips consumed_at from null owns the restart; a
  // second concurrent start finds nothing to claim and resumes normally
  // through the in_progress branch instead.
  const { data: claimed } = (await restarts(svc)
    .update({
      consumed_at: new Date().toISOString(),
      new_expires_at: stamps.expiresAt,
      new_started_at: stamps.startedAt,
    })
    .eq("id", grant.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle()) as { data: { id: string } | null };

  if (!claimed) return { resumed: false };

  // Reopen the paper. `started_at` is shifted forward by exactly the time
  // already used, so time_taken_seconds — the TEAM TIE-BREAK — stays honest
  // and the hours a dead phone spent on a charger are not counted as
  // answering time. Guarded on the closed status so this can never reopen a
  // paper a concurrent submit has just finished.
  const { data: reopened } = await svc
    .from("attempts")
    .update({
      status: "in_progress",
      started_at: stamps.startedAt,
      expires_at: stamps.expiresAt,
      submitted_at: null,
    })
    .eq("id", attemptId)
    .eq("status", attempt.status)
    .select("id")
    .maybeSingle();

  if (!reopened) {
    // The attempt moved under us. Hand the grant back rather than burn it.
    await restarts(svc)
      .update({ consumed_at: null, new_expires_at: null, new_started_at: null })
      .eq("id", grant.id);
    return { resumed: false };
  }

  console.log(
    JSON.stringify({
      tag: "yiq_restart",
      verdict: "consumed",
      attemptId,
      studentId: attempt.student_id,
      grantedMs,
      expiresAt: stamps.expiresAt,
    })
  );

  return { resumed: true, expiresAt: stamps.expiresAt, grantedMs };
}
