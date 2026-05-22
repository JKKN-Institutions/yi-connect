import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { listVolunteers } from "@/app/actions/volunteers";
import { VolunteersClient } from "./volunteers-client";

export default async function VolunteersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const volunteers = await listVolunteers(id);

  return (
    <VolunteersClient
      eventId={id}
      eventName={event.name}
      initialVolunteers={volunteers}
    />
  );
}
