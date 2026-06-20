"use server";

import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { createServiceClient } from "@/lib/yip/supabase/server";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SchoolRosterExport {
  filename: string;
  csv: string;
  /** Number of students whose school was included (and then purged). */
  count: number;
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * ONE-TIME school roster export, then permanent purge.
 *
 * School is collected only to balance the allocation (parties + committees) and
 * is never shown in the platform. This is the single moment a chapter admin can
 * pull the school↔student mapping out — it builds a CSV (name, school, and the
 * allocation result) and, in the same call, PERMANENTLY blanks school_name for
 * every student of the event and stamps events.school_export_downloaded_at.
 *
 * Refuses if it has already been run for this event (the stamp is set) so it can
 * only ever happen once. Event-scoped: requires canManage (the chapter admin).
 */
export async function exportSchoolRosterOnce(
  eventId: string
): Promise<ActionResult<SchoolRosterExport>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const service = await createServiceClient();

  // Guard: one-time only.
  const { data: ev, error: evErr } = await service
    .from("events")
    .select("name, school_export_downloaded_at")
    .eq("id", eventId)
    .maybeSingle<{ name: string; school_export_downloaded_at: string | null }>();
  if (evErr) return { success: false, error: evErr.message };
  if (!ev) return { success: false, error: "Event not found" };
  if (ev.school_export_downloaded_at) {
    return {
      success: false,
      error:
        "The school roster has already been downloaded for this event. School data was permanently deleted and cannot be exported again.",
    };
  }

  // Fetch the school↔student mapping plus the allocation result, ordered by
  // school then name so the file reads school-wise (matching the import).
  const { data: rows, error: rowsErr } = await service
    .from("participants")
    .select(
      "full_name, school_name, party_number, party_side, constituency_name, committee_name, parliament_role"
    )
    .eq("event_id", eventId)
    .order("school_name", { ascending: true })
    .order("full_name", { ascending: true });
  if (rowsErr) return { success: false, error: rowsErr.message };

  const list = (rows ?? []) as Array<{
    full_name: string | null;
    school_name: string | null;
    party_number: number | null;
    party_side: string | null;
    constituency_name: string | null;
    committee_name: string | null;
    parliament_role: string | null;
  }>;

  const withSchool = list.filter((r) => (r.school_name ?? "").trim());
  if (withSchool.length === 0) {
    return {
      success: false,
      error:
        "No school data to export for this event (it was never imported, or has already been purged).",
    };
  }

  const headers = [
    "Name",
    "School",
    "Party",
    "Side",
    "Constituency",
    "Committee",
    "Role",
  ];
  const body = list.map((r) =>
    [
      r.full_name ?? "",
      r.school_name ?? "",
      r.party_number != null ? `Party ${r.party_number}` : "",
      r.party_side ?? "",
      r.constituency_name ?? "",
      r.committee_name ?? "",
      r.parliament_role ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = [headers.map(csvCell).join(","), ...body].join("\r\n");

  // PERMANENT purge — blank school for every student of the event, and stamp the
  // event so this export can never run again. (Stamp first so a failed purge
  // still closes the one-time window; the purge below is the irreversible bit.)
  const stampedAt = new Date().toISOString();
  const { error: stampErr } = await service
    .from("events")
    // Column post-dates the generated types — cast the payload (loose-cast
    // pattern for new columns until `gen types` is re-run).
    .update({ school_export_downloaded_at: stampedAt } as never)
    .eq("id", eventId)
    .is("school_export_downloaded_at" as never, null); // race-safe one-time guard
  if (stampErr) return { success: false, error: stampErr.message };

  const { error: purgeErr } = await service
    .from("participants")
    .update({ school_name: "" })
    .eq("event_id", eventId);
  if (purgeErr) {
    return {
      success: false,
      error: `Export prepared but the school purge failed: ${purgeErr.message}. Re-run is blocked; contact support.`,
    };
  }

  const safeName = (ev.name || "roster").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    success: true,
    data: {
      filename: `${safeName}-schools.csv`,
      csv,
      count: withSchool.length,
    },
  };
}
