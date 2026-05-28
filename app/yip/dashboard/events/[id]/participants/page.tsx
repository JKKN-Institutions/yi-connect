import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { ParticipantsClient } from "./participants-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function ParticipantsPage({
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
    .select("id, created_by, allocation_locked, status")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's participants. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Fetch participants
  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", id)
    .order("full_name");

  return (
    <ParticipantsClient
      eventId={id}
      participants={participants ?? []}
      allocationLocked={event.allocation_locked ?? false}
    />
  );
}
