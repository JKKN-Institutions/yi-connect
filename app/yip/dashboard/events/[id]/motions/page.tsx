import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { listMotions } from "@/app/actions/yip/motions";
import { MotionsClient } from "./motions-client";

export default async function MotionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const motions = await listMotions(eventId);

  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side")
    .eq("event_id", eventId)
    .order("full_name");

  return (
    <MotionsClient
      eventId={eventId}
      eventName={event.name}
      initialMotions={motions}
      participants={participants ?? []}
    />
  );
}
