"use server";

/**
 * Public share links for the feedback report.
 *
 * A share link is an unguessable token that maps to one event. Opening
 * /yip/r/[token] renders the feedback report WITHOUT any respondent names or
 * emails — those are stripped in getPublicFeedbackReport() before the data
 * leaves the server, so a shared link can never expose a student's identity.
 *
 * create/revoke/get(token for org) are organizer-gated (canManage). The public
 * fetch is intentionally UNGATED — the token IS the authorization — and reads
 * via the service client (yip.feedback_report_shares is RLS-closed to anon).
 */
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { type FeedbackStats } from "./feedback";
import type { FeedbackResponseRow } from "@/lib/yip/feedback";
import { revalidatePath } from "next/cache";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// yip.feedback_report_shares is not in the generated DB types — narrow, local.
type ShareRow = { token: string; event_id: string; revoked_at: string | null };
type SharesTable = {
  select: (cols?: string) => SharesTable;
  insert: (row: Record<string, unknown>) => SharesTable;
  update: (row: Record<string, unknown>) => SharesTable;
  eq: (col: string, val: unknown) => SharesTable;
  is: (col: string, val: null) => SharesTable;
  order: (col: string, opts?: { ascending?: boolean }) => SharesTable;
  limit: (n: number) => SharesTable;
  maybeSingle: () => Promise<{ data: ShareRow | null; error: { message: string } | null }>;
  then: Promise<{ data: ShareRow[] | null; error: { message: string } | null }>["then"];
};
function sharesTable(sb: Awaited<ReturnType<typeof createServiceClient>>): SharesTable {
  return (sb as unknown as { from: (t: string) => SharesTable }).from("feedback_report_shares");
}

/** The current active (non-revoked) share token for this event, or null. */
export async function getFeedbackShareToken(
  eventId: string
): Promise<ActionResult<string | null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();
  const { data } = await sharesTable(supabase)
    .select("token, event_id, revoked_at")
    .eq("event_id", eventId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { success: true, data: data?.token ?? null };
}

/** Create (or return the existing) active share token for this event. */
export async function createFeedbackShareLink(
  eventId: string
): Promise<ActionResult<string>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const existing = await getFeedbackShareToken(eventId);
  if (existing.success && existing.data) return { success: true, data: existing.data };

  const token = randomBytes(16).toString("hex"); // 128-bit, unguessable
  const { error } = await sharesTable(supabase).insert({ token, event_id: eventId });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/feedback/report`);
  return { success: true, data: token };
}

/** Revoke every active share token for this event (old links stop working). */
export async function revokeFeedbackShareLink(
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();
  const { error } = await sharesTable(supabase)
    .update({ revoked_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .is("revoked_at", null);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/feedback/report`);
  return { success: true, data: null };
}

export type PublicFeedbackReport = {
  eventName: string;
  day1Date: string | null;
  stats: FeedbackStats;
  rows: FeedbackResponseRow[];
};

/**
 * Resolve a share token to its report data — UNGATED (token is the key).
 * Returns null for unknown/revoked tokens. Names and emails are stripped here
 * so they never reach the public page.
 */
export async function getPublicFeedbackReport(
  token: string
): Promise<PublicFeedbackReport | null> {
  if (!token || token.length < 16) return null;
  const supabase = await createServiceClient();

  const { data: share } = await sharesTable(supabase)
    .select("token, event_id, revoked_at")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  if (!share) return null;

  const eventId = share.event_id;
  const { data: event } = await supabase
    .from("events")
    .select("name, day1_date")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  // listFeedback/getFeedbackStats are canManage-gated, so read directly here —
  // the token already authorized this. Then STRIP identity fields.
  const { data: raw } = await supabase
    .from("feedback")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false });

  const rows = ((raw ?? []) as FeedbackResponseRow[]).map((r) => ({
    ...r,
    respondent_name: null,
    respondent_email: null,
    respondent_participant_id: null,
  }));

  // Recompute stats over the same rows (reuse the org path for identical maths).
  const stats = statsFromRows(rows);

  return {
    eventName: (event as { name: string }).name,
    day1Date: (event as { day1_date: string | null }).day1_date ?? null,
    stats,
    rows,
  };
}

// Stats over an already-fetched (name-stripped) row set — mirrors
// getFeedbackStats without re-hitting the gated listFeedback.
function statsFromRows(rows: FeedbackResponseRow[]): FeedbackStats {
  const byType = { participant: 0, organizer: 0, volunteer: 0, jury: 0 };
  for (const r of rows) byType[r.respondent_type]++;
  const avg = (vals: Array<number | null>) => {
    const c = vals.filter((v): v is number => typeof v === "number");
    return c.length ? Math.round((c.reduce((a, b) => a + b, 0) / c.length) * 10) / 10 : null;
  };
  const npsScores = rows.map((r) => r.nps_score).filter((v): v is number => typeof v === "number");
  const npsBreakdown = { detractor: 0, passive: 0, promoter: 0 };
  for (const s of npsScores) npsBreakdown[s <= 6 ? "detractor" : s <= 8 ? "passive" : "promoter"]++;
  const rec = rows.map((r) => r.would_recommend).filter((v): v is boolean => typeof v === "boolean");
  const nps =
    npsScores.length > 0
      ? Math.round(((npsBreakdown.promoter - npsBreakdown.detractor) / npsScores.length) * 100)
      : null;
  return {
    total: rows.length,
    byType,
    avgOverall: avg(rows.map((r) => r.overall_rating)),
    avgOrganization: avg(rows.map((r) => r.organization_rating)),
    avgContent: avg(rows.map((r) => r.content_rating)),
    nps,
    npsBreakdown,
    recommendRate: rec.length ? rec.filter(Boolean).length / rec.length : null,
  };
}
