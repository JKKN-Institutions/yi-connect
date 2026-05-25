import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  listRegistrations,
  getRegistrationStats,
} from "@/app/yip/actions/registrations";
import { RegistrationsClient } from "./registrations-client";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (supabase as any)
    .from("events")
    .select("id, name, ingestion_enabled")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const [registrations, stats] = await Promise.all([
    listRegistrations(eventId),
    getRegistrationStats(eventId),
  ]);

  return (
    <RegistrationsClient
      eventId={eventId}
      eventName={event.name}
      ingestionEnabled={event.ingestion_enabled ?? true}
      initialRegistrations={registrations}
      initialStats={stats}
    />
  );
}
