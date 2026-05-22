import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { ParticipantsClient } from "./participants-client";

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

  if (!event) redirect("/yip/dashboard");

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
