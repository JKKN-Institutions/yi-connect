import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  listRegistrations,
  getRegistrationStats,
} from "@/app/yip/actions/registrations";
import { RegistrationsClient } from "./registrations-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function RegistrationsPage({
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
      <Forbidden403 reason="You don't have access to this event's registrations. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // DPDP: privacy-mode events do not collect personal data, so the bulk-PII
  // registration surface is disabled. Direct the organiser to the minimal
  // (serial + constituency) registration on the Participants tab instead.
  if (event.privacy_mode) {
    return (
      <Forbidden403 reason="This event is in privacy mode — registration with personal details is disabled. Add participants by serial number and constituency on the Participants tab." />
    );
  }

  const [registrations, stats] = await Promise.all([
    listRegistrations(eventId),
    getRegistrationStats(eventId),
  ]);

  const access = await getYipEventAccess(eventId);

  return (
    <RegistrationsClient
      eventId={eventId}
      eventName={event.name}
      ingestionEnabled={event.ingestion_enabled ?? true}
      initialRegistrations={registrations}
      initialStats={stats}
      canDelete={access.canDelete}
    />
  );
}
