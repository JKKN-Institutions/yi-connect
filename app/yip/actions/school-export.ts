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
 * Download the current allocation roster as a CSV — name + party (letter) +
 * constituency (no. + name + state) + committee (no.) + access code.
 *
 * Re-runnable any number of times so an organiser can re-download after adding
 * late registrants and re-running allocation. Non-destructive: it only reads the
 * roster and writes nothing. Event-scoped: requires canManage (chapter organiser
 * or above) — the access code is the student's login, so this stays manager-only.
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

  // party_number → display name ("Party A".."Party E"), so the roster shows the
  // party the way the dashboard does (not a bare number).
  const { data: partyRows } = await service
    .from("parties")
    .select("party_number, name")
    .eq("event_id", eventId);
  const partyNameByNumber = new Map(
    (partyRows ?? []).map((p) => [p.party_number, p.name])
  );

  // Ordered party-wise then by seat number so the file reads as a clean roster.
  const { data: rows, error: rowsErr } = await service
    .from("participants")
    .select(
      "full_name, party_number, constituency_number, constituency_name, constituency_state, committee_number, access_code"
    )
    .eq("event_id", eventId)
    .order("party_number", { ascending: true, nullsFirst: false })
    .order("constituency_number", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true });
  if (rowsErr) return { success: false, error: rowsErr.message };

  const list = (rows ?? []) as Array<{
    full_name: string | null;
    party_number: number | null;
    constituency_number: number | null;
    constituency_name: string | null;
    constituency_state: string | null;
    committee_number: number | null;
    access_code: string | null;
  }>;

  if (list.length === 0) {
    return {
      success: false,
      error: "No registrants to export for this event yet.",
    };
  }

  // Ruling/Opposition ("Side") is intentionally OUT — it's decided on event day,
  // not at allocation. Party shows the bare letter (A, B, …) and Committee shows
  // its number (1..N) — the short identifiers students use, and the format the
  // allocated-roster upload reads back. Access Code IS included so the organiser
  // can hand each student their login alongside their allocation (canManage-gated).
  const headers = [
    "Name",
    "Party",
    "Constituency No.",
    "Constituency",
    "Constituency State",
    "Committee No.",
    "Access Code",
  ];
  const body = list.map((r) => {
    // Bare party letter: strip the "Party " prefix so the default "Party A".."Party G"
    // reads as "A".."G", while a chapter that renamed a party keeps its custom name.
    const partyName =
      r.party_number != null
        ? partyNameByNumber.get(r.party_number) ?? `Party ${r.party_number}`
        : "";
    const partyLabel = partyName.replace(/^Party\s+/i, "");
    return [
      r.full_name ?? "",
      partyLabel,
      r.constituency_number ?? "",
      r.constituency_name ?? "",
      r.constituency_state ?? "",
      r.committee_number ?? "",
      r.access_code ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
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
