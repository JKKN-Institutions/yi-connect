import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { listParties } from "@/app/yip/actions/parties";
import { PartiesClient } from "./parties-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function PartiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(eventId);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's parties. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const supabase = await createServiceClient();

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
