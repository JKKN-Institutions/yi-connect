"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import type { Json } from "@/types/yip/database";
import {
  computeNps,
  npsBucket,
  type FeedbackPayload,
  type FeedbackResponseRow,
  type FeedbackRespondentType,
  type NpsBucket,
} from "@/lib/yip/feedback";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// The `feedback_responses` table is added by migration 014 but not yet in
// generated types (intentional — types are regen'd centrally). We use a narrow
// `any`-cast at each query boundary to access it with good ergonomics.

// ─── Sanitize incoming payload ─────────────────────────────────────────
function cleanPayload(payload: FeedbackPayload) {
  const clamp = (n: number | null | undefined, min: number, max: number) => {
    if (n === null || n === undefined) return null;
    const v = Math.round(Number(n));
    if (Number.isNaN(v)) return null;
    return Math.min(max, Math.max(min, v));
  };
  const trim = (s: string | null | undefined) => {
    if (s === null || s === undefined) return null;
    const t = String(s).trim();
    return t.length === 0 ? null : t.slice(0, 2000);
  };
  return {
    overall_rating: clamp(payload.overall_rating ?? null, 1, 5),
    organization_rating: clamp(payload.organization_rating ?? null, 1, 5),
    content_rating: clamp(payload.content_rating ?? null, 1, 5),
    nps_score: clamp(payload.nps_score ?? null, 0, 10),
    would_recommend:
      payload.would_recommend === undefined ? null : !!payload.would_recommend,
    learned_something: trim(payload.learned_something),
    biggest_takeaway: trim(payload.biggest_takeaway),
    what_worked: trim(payload.what_worked),
    what_didnt_work: trim(payload.what_didnt_work),
    suggestions: trim(payload.suggestions),
    answers: (payload.answers ?? {}) as Json,
  };
}

// ─── Submit: participant ───────────────────────────────────────────────
export async function submitParticipantFeedback(
  eventId: string,
  participantId: string,
  payload: FeedbackPayload
): Promise<ActionResult<{ id: string }>> {
  if (!eventId || !participantId) {
    return { success: false, error: "Missing event or participant" };
  }
  // Participant self-service: verify the session owns participantId.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const cleaned = cleanPayload(payload);
  if (cleaned.overall_rating === null) {
    return { success: false, error: "Overall rating is required" };
  }

  const supabase = await createServiceClient();

  // Verify participant belongs to event
  const { data: p } = await supabase
    .from("participants")
    .select("id, event_id, full_name")
    .eq("id", participantId)
    .single();
  if (!p || p.event_id !== eventId) {
    return { success: false, error: "Participant not found in this event" };
  }

  // Check for existing submission
  const existing = await supabase
    .from("feedback")
    .select("id")
    .eq("event_id", eventId)
    .eq("respondent_participant_id", participantId)
    .eq("respondent_type", "participant")
    .maybeSingle();

  if (existing.data) {
    return {
      success: false,
      error: "You've already submitted feedback for this event.",
    };
  }

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      event_id: eventId,
      respondent_type: "participant",
      respondent_participant_id: participantId,
      respondent_name: p.full_name,
      ...cleaned,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Duplicate race — map unique-violation gracefully
    if (error?.code === "23505") {
      return {
        success: false,
        error: "You've already submitted feedback for this event.",
      };
    }
    return {
      success: false,
      error: error?.message ?? "Failed to submit feedback",
    };
  }

  return { success: true, data: { id: (data as { id: string }).id } };
}

// ─── Submit: non-participant (organizer / volunteer / jury) ────────────
export async function submitOrganizerFeedback(
  eventId: string,
  name: string,
  email: string,
  payload: FeedbackPayload,
  respondentType: Exclude<FeedbackRespondentType, "participant"> = "organizer"
): Promise<ActionResult<{ id: string }>> {
  if (!eventId) return { success: false, error: "Missing event" };
  const nm = (name ?? "").trim();
  const em = (email ?? "").trim().toLowerCase();
  if (nm.length < 2) {
    return { success: false, error: "Please enter your name" };
  }
  if (!em.includes("@") || em.length < 5) {
    return { success: false, error: "Please enter a valid email" };
  }
  const cleaned = cleanPayload(payload);
  if (cleaned.overall_rating === null) {
    return { success: false, error: "Overall rating is required" };
  }

  const supabase = await createServiceClient();

  // Verify event status — only allow when event is completed or later
  const { data: event } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .single();
  if (!event) return { success: false, error: "Event not found" };

  const allowedStatuses = ["day2_live", "completed", "results_published"];
  if (!allowedStatuses.includes(event.status)) {
    return {
      success: false,
      error:
        "Feedback opens after the event. Please check back once the session has concluded.",
    };
  }

  // App-level duplicate check for non-participant rows (DB unique doesn't
  // apply because participant_id is NULL and NULLs are distinct).
  const existing = await supabase
    .from("feedback")
    .select("id")
    .eq("event_id", eventId)
    .eq("respondent_type", respondentType)
    .eq("respondent_email", em)
    .maybeSingle();

  if (existing.data) {
    return {
      success: false,
      error: "We already have feedback from this email. Thank you!",
    };
  }

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      event_id: eventId,
      respondent_type: respondentType,
      respondent_participant_id: null,
      respondent_name: nm,
      respondent_email: em,
      ...cleaned,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to submit feedback",
    };
  }

  return { success: true, data: { id: (data as { id: string }).id } };
}

// ─── Has-submitted check (for participant survey page) ────────────────
export async function getMyFeedback(
  eventId: string,
  participantId: string
): Promise<FeedbackResponseRow | null> {
  // Only the student themselves may read their own feedback row.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return null;
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("feedback")
    .select("*")
    .eq("event_id", eventId)
    .eq("respondent_participant_id", participantId)
    .eq("respondent_type", "participant")
    .maybeSingle();
  return (data as FeedbackResponseRow) ?? null;
}

// ─── List feedback (organizer-only view) ──────────────────────────────
export async function listFeedback(
  eventId: string,
  respondentType?: FeedbackRespondentType
): Promise<FeedbackResponseRow[]> {
  // Respondent names + emails — organiser-only for THIS event. getFeedbackStats
  // and exportFeedbackCSV both read through here, so this gate covers them too.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return [];
  const supabase = await createServiceClient();
  let q = supabase
    .from("feedback")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false });
  if (respondentType) {
    q = q.eq("respondent_type", respondentType);
  }
  const { data } = await q;
  return (data ?? []) as FeedbackResponseRow[];
}

// ─── Stats ─────────────────────────────────────────────────────────────
export type FeedbackStats = {
  total: number;
  byType: Record<FeedbackRespondentType, number>;
  avgOverall: number | null;
  avgOrganization: number | null;
  avgContent: number | null;
  nps: number | null;
  npsBreakdown: Record<NpsBucket, number>;
  recommendRate: number | null; // 0-1 share of would_recommend=true
};

export async function getFeedbackStats(
  eventId: string
): Promise<FeedbackStats> {
  const rows = await listFeedback(eventId);
  const total = rows.length;

  const byType: Record<FeedbackRespondentType, number> = {
    participant: 0,
    organizer: 0,
    volunteer: 0,
    jury: 0,
  };
  for (const r of rows) byType[r.respondent_type]++;

  const avg = (vals: Array<number | null>) => {
    const clean = vals.filter((v): v is number => typeof v === "number");
    if (clean.length === 0) return null;
    return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 10) / 10;
  };

  const npsScores = rows
    .map((r) => r.nps_score)
    .filter((v): v is number => typeof v === "number");

  const npsBreakdown: Record<NpsBucket, number> = {
    detractor: 0,
    passive: 0,
    promoter: 0,
  };
  for (const s of npsScores) npsBreakdown[npsBucket(s)]++;

  const recommendVals = rows
    .map((r) => r.would_recommend)
    .filter((v): v is boolean => typeof v === "boolean");
  const recommendRate =
    recommendVals.length > 0
      ? recommendVals.filter((v) => v).length / recommendVals.length
      : null;

  return {
    total,
    byType,
    avgOverall: avg(rows.map((r) => r.overall_rating)),
    avgOrganization: avg(rows.map((r) => r.organization_rating)),
    avgContent: avg(rows.map((r) => r.content_rating)),
    nps: npsScores.length > 0 ? computeNps(npsScores) : null,
    npsBreakdown,
    recommendRate,
  };
}

// ─── CSV export ────────────────────────────────────────────────────────
export async function exportFeedbackCSV(
  eventId: string
): Promise<{ success: true; data: { csv: string; filename: string } } | { success: false; error: string }> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, day1_date")
    .eq("id", eventId)
    .single();
  if (!event) return { success: false, error: "Event not found" };

  const rows = await listFeedback(eventId);

  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""').replace(/\r?\n/g, " ");
    return `"${s}"`;
  };

  const headers = [
    "submitted_at",
    "respondent_type",
    "respondent_name",
    "respondent_email",
    "overall_rating",
    "organization_rating",
    "content_rating",
    "nps_score",
    "would_recommend",
    "biggest_takeaway",
    "learned_something",
    "what_worked",
    "what_didnt_work",
    "suggestions",
    "answers_json",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.submitted_at,
        r.respondent_type,
        r.respondent_name ?? "",
        r.respondent_email ?? "",
        r.overall_rating ?? "",
        r.organization_rating ?? "",
        r.content_rating ?? "",
        r.nps_score ?? "",
        r.would_recommend === null || r.would_recommend === undefined
          ? ""
          : r.would_recommend
            ? "yes"
            : "no",
        r.biggest_takeaway ?? "",
        r.learned_something ?? "",
        r.what_worked ?? "",
        r.what_didnt_work ?? "",
        r.suggestions ?? "",
        JSON.stringify(r.answers ?? {}),
      ]
        .map(esc)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const safeName = event.name.replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = `YIP_${safeName}_Feedback_${event.day1_date}.csv`;

  return { success: true, data: { csv, filename } };
}
