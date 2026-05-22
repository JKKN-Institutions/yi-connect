import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
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

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by, allocation_locked, committee_topics")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

  // Fetch participants with all allocation fields
  const { data: participants } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, class, home_state, party_side, parliament_role, ministry, constituency_name, constituency_state, committee_name, serial_no, party_number, committee_number"
    )
    .eq("event_id", id)
    .order("serial_no", { nullsFirst: false })
    .order("full_name");

  // Parse custom committee topics
  let customCommittees: string[] | undefined;
  if (event.committee_topics) {
    try {
      const topics = event.committee_topics as unknown;
      if (Array.isArray(topics) && topics.length > 0) {
        customCommittees = topics.map(String);
      }
    } catch {
      // Ignore
    }
  }

  return (
    <AllocationClient
      eventId={id}
      participants={participants ?? []}
      allocationLocked={event.allocation_locked ?? false}
      customCommittees={customCommittees}
    />
  );
}
