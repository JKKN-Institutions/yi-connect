"use server";

import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { createServiceClient } from "@/lib/yip/supabase/server";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface AllocationRosterExport {
  filename: string;
  csv: string;
  /** Number of registrants in the roster. */
  count: number;
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Download the current allocation roster as a CSV — name + party + side +
 * constituency + committee + role.
 *
 * Re-runnable any number of times so an organiser can re-download after adding
 * late registrants and re-running allocation. Non-destructive: it only reads the
 * roster and writes nothing (it does NOT touch the balancing data, which is held
 * until the event's PII is removed at close-out). Event-scoped: requires
 * canManage (chapter organiser or above).
 */
export async function exportAllocationRoster(
  eventId: string
): Promise<ActionResult<AllocationRosterExport>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const service = await createServiceClient();

  const { data: ev, error: evErr } = await service
    .from("events")
    .select("name")
    .eq("id", eventId)
    .maybeSingle<{ name: string }>();
  if (evErr) return { success: false, error: evErr.message };
  if (!ev) return { success: false, error: "Event not found" };

  // Ordered party-wise then by name so the file reads as a clean roster.
  const { data: rows, error: rowsErr } = await service
    .from("participants")
    .select(
      "full_name, party_number, party_side, constituency_name, committee_name, parliament_role"
    )
    .eq("event_id", eventId)
    .order("party_number", { ascending: true })
    .order("full_name", { ascending: true });
  if (rowsErr) return { success: false, error: rowsErr.message };

  const list = (rows ?? []) as Array<{
    full_name: string | null;
    party_number: number | null;
    party_side: string | null;
    constituency_name: string | null;
    committee_name: string | null;
    parliament_role: string | null;
  }>;

  if (list.length === 0) {
    return {
      success: false,
      error: "No registrants to export for this event yet.",
    };
  }

  const headers = ["Name", "Party", "Side", "Constituency", "Committee", "Role"];
  const body = list.map((r) =>
    [
      r.full_name ?? "",
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

  const safeName = (ev.name || "roster").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    success: true,
    data: {
      filename: `${safeName}-roster.csv`,
      csv,
      count: list.length,
    },
  };
}
