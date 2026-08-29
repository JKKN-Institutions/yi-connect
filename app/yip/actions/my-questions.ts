"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { effectiveMinistries, ministryLabel } from "@/lib/yip/cabinet";

/**
 * What became of the questions a member tabled.
 *
 * WHY THIS EXISTS. After day 1 of the live SRTN round a participant wrote in:
 * her chapter had researched hard and then watched half of Question Hour get
 * cancelled. The platform made that worse by keeping no record — 135 questions
 * were approved on that event and 129 have no trace of ever being put. A member
 * whose question was never called could not tell whether the House had run out
 * of time or whether her question had never been cleared at all. This closes
 * that gap: every question she tabled, and honestly what happened to it.
 *
 * The load-bearing outcome is `not_reached` — cleared by the Chair, never
 * called. It exists so the page can say the clock ran out rather than leaving a
 * sixteen-year-old to conclude her question was not good enough.
 *
 * NO SCORES, NO RANKS, NO ONE ELSE. This returns only the caller's own rows.
 * Nothing here is derived from a juror, and no other member's question is ever
 * loaded, so nothing on this path can leak a comparison.
 *
 * NO LLM. YIP production never calls one. Every word rendered from this is a
 * fixed sentence chosen by a status value.
 */

/**
 * What happened to a question, collapsed from the raw status column.
 *
 *  put         — reached the floor (`asked`, `answered`, and `skipped`, which
 *                is only ever set on the question currently being asked)
 *  not_reached — `approved`: cleared to be put, Question Hour ended first
 *  with_chair  — `submitted`: still awaiting review
 *  not_taken   — `rejected`: not carried forward, shown without a reason
 */
export type QuestionOutcome =
  | "put"
  | "not_reached"
  | "with_chair"
  | "not_taken";

export interface TabledQuestion {
  id: string;
  text: string;
  /** Display label of the ministry it was directed to, per this event's cabinet. */
  ministry: string;
  outcome: QuestionOutcome;
  /** Reached the floor and the House moved on before an answer was recorded. */
  passedOver: boolean;
  /** True while this is the question on the floor right now. */
  onTheFloorNow: boolean;
}

/** Raw `questions.status` → the outcome a member is shown. */
function outcomeFor(status: string | null): QuestionOutcome {
  switch (status) {
    case "asked":
    case "answered":
    case "skipped":
      return "put";
    case "approved":
      return "not_reached";
    case "rejected":
      return "not_taken";
    default:
      // `submitted`, and anything a future migration adds. Defaulting to
      // "still with the Chair" is the safe direction: an unknown state must
      // never be reported to a minor as a rejection.
      return "with_chair";
  }
}

/**
 * Returns the CALLING member's own tabled questions. Takes no id ON PURPOSE.
 *
 * This file is "use server", so this export is a callable endpoint. An earlier
 * version of the sibling profile engine took a `participantId` argument and
 * read on the service client, which bypasses RLS — meaning anyone could post
 * any id and read any student's record. Commit a5011e2c closed that. The
 * subject here is resolved from the signed participant cookie and from nowhere
 * else; there is no id to tamper with and none is read from the URL.
 *
 * Returns null when the caller is not a participant of a real event, so the
 * page can tell "nothing to show you" apart from "you tabled nothing" ([]).
 */
export async function getMyTabledQuestions(): Promise<TabledQuestion[] | null> {
  const session = await getYipSession();
  if (!session || session.type !== "participant") return null;
  const participantId = session.id;

  const supabase = await createServiceClient();

  const { data: me } = await supabase
    .from("participants")
    .select("id, event_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!me?.event_id) return null;
  const eventId = me.event_id as string;

  // The event's effective cabinet, so a chapter running its own portfolios
  // (Erode 2026 announced 10, the handbook ships 8) shows its own labels
  // rather than a raw key like "education".
  const { data: eventRow } = await supabase
    .from("events")
    .select("cabinet_ministries")
    .eq("id", eventId)
    .maybeSingle();
  const ministries = effectiveMinistries(eventRow?.cabinet_ministries);

  // submitted_by is a participants id, which is already event-scoped, so it
  // alone would be sufficient. event_id is kept as a second predicate for the
  // same reason every other read here carries it — a fail-closed habit.
  const { data: rows } = await supabase
    .from("questions")
    .select("id, question_text, directed_to_ministry, status, created_at")
    .eq("event_id", eventId)
    .eq("submitted_by", participantId)
    .order("created_at", { ascending: true });

  return (rows ?? []).map((q) => ({
    id: q.id,
    text: q.question_text,
    ministry: ministryLabel(q.directed_to_ministry, ministries),
    outcome: outcomeFor(q.status),
    passedOver: q.status === "skipped",
    onTheFloorNow: q.status === "asked",
  }));
}
