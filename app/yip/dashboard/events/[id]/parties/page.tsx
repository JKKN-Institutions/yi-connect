import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { listParties } from "@/app/actions/parties";
import { PartiesClient } from "./parties-client";

export default async function PartiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, level, chapter_name")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, school_name, party_side, party_id, parliament_role")
    .eq("event_id", eventId)
    .order("full_name");

  const parties = await listParties(eventId);

  return (
    <PartiesClient
      eventId={eventId}
      eventName={event.name}
      initialParties={parties}
      participants={participants ?? []}
    />
  );
}
