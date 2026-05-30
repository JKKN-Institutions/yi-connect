import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { listMotions } from "@/app/yip/actions/motions";
import { MotionsClient } from "./motions-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function MotionsPage({
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
      <Forbidden403 reason="You don't have access to this event's motions. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const supabase = await createServiceClient();

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
