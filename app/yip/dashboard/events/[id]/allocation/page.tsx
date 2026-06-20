import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { AllocationClient } from "./allocation-client";

export default async function AllocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's allocation. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Fetch participants with all allocation fields
  const { data: participants } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, class, home_state, party_side, parliament_role, ministry, constituency_name, constituency_state, committee_name, serial_no, party_number, committee_number"
    )
    .eq("event_id", id)
    .order("serial_no", { nullsFirst: false })
    .order("full_name");

  // Parties must be set up (>=1 ruling + >=1 opposition) before allocation can
  // run — the engine assigns participants into those benches.
  const { data: parties } = await supabase
    .from("parties")
    .select("party_number, name, side")
    .eq("event_id", id)
    .order("party_number", { nullsFirst: false });
  const rulingPartyCount = (parties ?? []).filter(
    (p) => p.side === "ruling"
  ).length;
  const oppositionPartyCount = (parties ?? []).filter(
    (p) => p.side === "opposition"
  ).length;

  // Parse the event's selected committees. committee_topics is either a legacy
  // array of names, or a { committeeName → topic } map whose KEYS are the names.
  let customCommittees: string[] | undefined;
  if (event.committee_topics) {
    const t = event.committee_topics as unknown;
    if (Array.isArray(t) && t.length > 0) {
      customCommittees = t.map(String);
    } else if (t && typeof t === "object") {
      const keys = Object.keys(t as Record<string, unknown>);
      if (keys.length > 0) customCommittees = keys;
    }
  }

  return (
    <AllocationClient
      eventId={id}
      participants={participants ?? []}
      parties={parties ?? []}
      allocationLocked={event.allocation_locked ?? false}
      customCommittees={customCommittees}
      rulingPartyCount={rulingPartyCount}
      oppositionPartyCount={oppositionPartyCount}
    />
  );
}
