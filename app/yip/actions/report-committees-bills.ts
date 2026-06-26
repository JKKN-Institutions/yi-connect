"use server";

/**
 * Server action for the YIP Chapter Round Report — Section 5/8
 * (Committees & Bills).
 *
 * Follows the reference action contract (app/yip/actions/report-overview.ts):
 *   - "use server": exports ONLY async functions (the BillOutcome type + any
 *     consts live in lib/yip/report/sections/committees-bills.ts).
 *   - every write gates with getYipEventAccess(eventId).canManage and returns a
 *     structured { success, error } result (NEVER throws / redirects).
 *   - revalidatePath the report page so the freshly-filled value re-renders.
 *
 * Two report-only gaps an organiser can fill inline:
 *   1. saveReportCommitteeLeader — set/clear the committee's leader name
 *      (committee_meta.chair_lead). Used when no participant holds
 *      parliament_role='committee_chair' in that committee.
 *   2. saveReportBillOutcome — override the report's Passed/Rejected/Not
 *      Presented line (committee_meta.report_bill_outcome_override). This is
 *      REPORT-ONLY: it never touches the live bills.status / vote tally. Pass
 *      "auto" to clear the override and fall back to the derived outcome.
 *
 * Both upsert on committee_meta's UNIQUE (event_id, committee_name) so a row is
 * created on first fill and updated thereafter. committee_meta is service-role
 * only (RLS on, no policies), so these gated actions are the only write path.
 * committee_meta is not in the generated Database types, so each write goes
 * through a per-call loose-cast client (same escape-hatch idiom the report data
 * helpers use for not-yet-typed tables/columns).
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Set (or clear) the committee leader name for the report. Pass an empty string
 * to clear it (stored as NULL).
 */
export async function saveReportCommitteeLeader(
  eventId: string,
  committeeName: string,
  leaderName: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const committee = (committeeName ?? "").trim();
  if (!committee) {
    return { success: false, error: "Missing committee." };
  }

  const trimmed = (leaderName ?? "").trim();
  const svc = await createServiceClient();
  // yip.committee_meta is not in the generated Database types, so write through
  // a per-call loose-cast client.
  const svcMeta = svc as unknown as {
    from: (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await svcMeta.from("committee_meta").upsert(
    {
      event_id: eventId,
      committee_name: committee,
      chair_lead: trimmed.length > 0 ? trimmed : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,committee_name" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}

/**
 * Override (or clear) the report outcome for a committee's bill. Accepts
 * "passed" | "rejected" | "not_presented" to set an override, or "auto" to
 * clear it and fall back to the outcome derived from the live bill status.
 * Report-only — does NOT change bills.status or the vote tally.
 */
export async function saveReportBillOutcome(
  eventId: string,
  committeeName: string,
  outcome: "passed" | "rejected" | "not_presented" | "auto"
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const committee = (committeeName ?? "").trim();
  if (!committee) {
    return { success: false, error: "Missing committee." };
  }

  if (
    outcome !== "passed" &&
    outcome !== "rejected" &&
    outcome !== "not_presented" &&
    outcome !== "auto"
  ) {
    return { success: false, error: "Invalid outcome." };
  }

  const value = outcome === "auto" ? null : outcome;
  const svc = await createServiceClient();
  // yip.committee_meta + its new report_bill_outcome_override column are not in
  // the generated Database types, so write through a per-call loose-cast client.
  const svcMeta = svc as unknown as {
    from: (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await svcMeta.from("committee_meta").upsert(
    {
      event_id: eventId,
      committee_name: committee,
      report_bill_outcome_override: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,committee_name" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}
