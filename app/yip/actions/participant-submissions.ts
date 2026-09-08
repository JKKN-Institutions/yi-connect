"use server";

/**
 * An organiser's read of what ONE participant has actually handed in for an
 * event — their Selection Questionnaire paper(s), with every uploaded file
 * openable, and, if they have one, their Private Member's Bill.
 *
 * Sibling to app/yip/actions/participant-profile.ts (the rest of the
 * participant record). Does NOT replace the full organiser marking screen at
 * app/yip/dashboard/events/[id]/questionnaire — this summarises one person's
 * papers and reuses that screen's own getQuestionnaireFileUrl (from
 * app/yip/actions/questionnaire.ts, unmodified) to open a handed-in file.
 *
 * ─── SCORES ────────────────────────────────────────────────────────────────
 * A questionnaire mark is a NAMED score belonging to a minor student —
 * exactly the category lib/yip/auth/event-access.ts documents
 * `canViewScores` as existing to protect (chair + super-admin only; see also
 * regional.ts and the three-times-confirmed decision that flipping that
 * default is not a bug fix). So here, a mark is nulled out server-side for
 * anyone without `canViewScores`.
 *
 * The shipped Questionnaire admin screen (getQuestionnaireResults /
 * getQuestionnaireAttemptDetail in app/yip/actions/questionnaire.ts) USED to
 * show marks to anyone with `canView` — that was a real gap, not a deliberate
 * call, and it is closed as of 2026-08-26 (Director decision: "mark papers,
 * but not see the league table"). Both functions now null the same score
 * fields for the same viewers this file already protected, so the two
 * screens agree.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  answerIsGiven,
  parseAnswerFiles,
  questionnaireContestLabel,
  type QuestionnaireAnswerFile,
  type ScoringStatus,
} from "@/lib/yip/questionnaire";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Loose access to questionnaire_attempts / questionnaire_answers ───────
// Neither table exists in the generated types/yip/database.ts (schema drift —
// app/yip/actions/questionnaire.ts already works around the same gap with its
// own local `tbl()` cast). That file exports no such helper and is explicitly
// off-limits for this PR, so a minimal read-only copy lives here instead.
type SB = Awaited<ReturnType<typeof createServiceClient>>;
type LooseRow<T> = {
  select: (cols: string) => LooseRow<T>;
  eq: (col: string, val: unknown) => LooseRow<T>;
  in: (col: string, vals: readonly unknown[]) => LooseRow<T>;
  order: (col: string, opts?: { ascending?: boolean }) => LooseRow<T>;
  then: Promise<{ data: T[] | null; error: unknown }>["then"];
};
function looseTbl<T>(sb: SB, name: string): LooseRow<T> {
  return (sb as unknown as { from: (t: string) => LooseRow<T> }).from(name);
}

type AttemptRow = {
  id: string;
  post_key: string;
  started_at: string | null;
  submitted_at: string | null;
  scoring_status: string;
  total_score: number | null;
  max_score: number | null;
  pct: number | null;
};
type AnswerRow = {
  attempt_id: string;
  answer_text: string | null;
  files: unknown;
};

export type ParticipantQuestionnairePaper = {
  attemptId: string;
  postKey: string;
  /** The post, split by bench for the Cabinet/Shadow paper — see questionnaireContestLabel. */
  contestLabel: string;
  /** Plain English — never a raw scoring_status value. */
  statusLabel: string;
  /** True when the underlying scoring_status is "scored" — even if pct below is nulled for this viewer. */
  scored: boolean;
  submittedAt: string | null;
  answered: number;
  drawn: number;
  /**
   * True when at least one answer has typed text. A file-only paper (e.g. a
   * photographed Student Journalist report) has answered > 0 but this false —
   * distinguish the two so a file-only submission never reads as blank.
   */
  hasTypedText: boolean;
  /** Null when not yet marked, or when this viewer lacks canViewScores. */
  pct: number | null;
  totalScore: number | null;
  maxScore: number | null;
  files: (QuestionnaireAnswerFile & { attemptId: string })[];
};

export type ParticipantBillSummary = {
  id: string;
  title: string;
  statusLabel: string;
};

export type ParticipantSubmissions = {
  papers: ParticipantQuestionnairePaper[];
  /** Whether pct/totalScore/maxScore above were let through, or nulled for this viewer. */
  canViewScores: boolean;
  bill: ParticipantBillSummary | null;
};

/**
 * Wording matched to app/yip/me/page.tsx (PR #1005) — the student's own bill
 * card — so the same bill reads the same way whether an organiser or the
 * Member who moved it is looking at it.
 */
const BILL_STATUS_LABELS: Record<string, string> = {
  drafting: "Still writing",
  submitted: "Handed in — waiting for an organiser",
  approved: "Approved — ready for the House",
  presented: "On the floor now",
  passed: "Passed by the House",
  rejected: "Not accepted — this decision is final",
};

function billStatusLabel(status: string | null): string {
  if (!status) return "Still writing";
  return BILL_STATUS_LABELS[status] ?? status;
}

function questionnaireStatusLabel(
  submittedAt: string | null,
  status: string
): string {
  if (!submittedAt) return "Not handed in yet";
  switch (status as ScoringStatus) {
    case "scored":
      return "Marked";
    case "needs_human":
      // Complete and waiting on a person — not a failure, not "not scored".
      // Same case app/yip/dashboard/events/[id]/questionnaire/questionnaire-admin-client.tsx
      // calls "read this one yourself".
      return "Waiting for a person to read it";
    case "scoring":
      return "Being marked now";
    case "failed":
      return "Couldn't be marked automatically — needs a person to check";
    case "pending":
    default:
      return "Still to be marked";
  }
}

/**
 * One participant's questionnaire paper(s) and Private Member's Bill for this
 * event, from an organiser's point of view. Gated on getYipEventAccess —
 * canView to read at all, canViewScores to see any mark (see the SCORES note
 * above).
 */
export async function getParticipantSubmissions(
  eventId: string,
  participantId: string
): Promise<ActionResult<ParticipantSubmissions>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const sb = await createServiceClient();

  const { data: participant } = await sb
    .from("participants")
    .select("id, party_side")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) return { success: false, error: "Not found." };

  const bench: "ruling" | "opposition" | null =
    participant.party_side === "ruling" || participant.party_side === "opposition"
      ? participant.party_side
      : null;

  // ─── Questionnaire paper(s) ─────────────────────────────────────────────
  const { data: attempts } = await looseTbl<AttemptRow>(sb, "questionnaire_attempts")
    .select(
      "id, post_key, started_at, submitted_at, scoring_status, total_score, max_score, pct"
    )
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .order("started_at", { ascending: true });

  const attemptRows = attempts ?? [];

  const answersByAttempt = new Map<string, AnswerRow[]>();
  if (attemptRows.length > 0) {
    const { data: answers } = await looseTbl<AnswerRow>(sb, "questionnaire_answers")
      .select("attempt_id, answer_text, files")
      .in(
        "attempt_id",
        attemptRows.map((a) => a.id)
      );
    for (const a of answers ?? []) {
      const list = answersByAttempt.get(a.attempt_id) ?? [];
      list.push(a);
      answersByAttempt.set(a.attempt_id, list);
    }
  }

  const papers: ParticipantQuestionnairePaper[] = attemptRows.map((a) => {
    const myAnswers = answersByAttempt.get(a.id) ?? [];
    const answered = myAnswers.filter((x) =>
      answerIsGiven(x.answer_text, x.files)
    ).length;
    const hasTypedText = myAnswers.some(
      (x) => (x.answer_text ?? "").trim() !== ""
    );
    const files = myAnswers.flatMap((x) =>
      parseAnswerFiles(x.files).map((f) => ({ ...f, attemptId: a.id }))
    );
    const scored = a.scoring_status === "scored";
    return {
      attemptId: a.id,
      postKey: a.post_key,
      contestLabel: questionnaireContestLabel(a.post_key, bench),
      statusLabel: questionnaireStatusLabel(a.submitted_at, a.scoring_status),
      scored,
      submittedAt: a.submitted_at,
      answered,
      drawn: myAnswers.length,
      hasTypedText,
      pct: access.canViewScores ? a.pct : null,
      totalScore: access.canViewScores ? a.total_score : null,
      maxScore: access.canViewScores ? a.max_score : null,
      files,
    };
  });

  // ─── Private Member's Bill, if any ──────────────────────────────────────
  // source / mover_participant_id are additive columns (see
  // lib/yip/bill-sources.ts) that may not exist yet on an un-migrated
  // environment. A query error here — missing columns or anything else —
  // simply reads as "no bill", the same degrade the rest of the bills code
  // already documents for these two columns.
  let bill: ParticipantBillSummary | null = null;
  const { data: billRow, error: billError } = await sb
    .from("bills")
    .select("id, title, status")
    .eq("event_id", eventId)
    .eq("source", "private_member")
    .eq("mover_participant_id", participantId)
    .maybeSingle();
  if (!billError && billRow) {
    bill = {
      id: billRow.id,
      title: billRow.title,
      statusLabel: billStatusLabel(billRow.status),
    };
  }

  return {
    success: true,
    data: { papers, canViewScores: access.canViewScores, bill },
  };
}
