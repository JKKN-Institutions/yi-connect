import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getEventParticipants } from "@/app/yip/actions/participants";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
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

  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's participants. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Fetch participants via the gated service-role action. The roster includes
  // access_code + PII; migration 20260609000000 revokes those columns from the
  // `authenticated` role, so this read must go through service_role (the action
  // re-checks getYipEventAccess().canManage, so it stays event-scoped).
  const participants = await getEventParticipants(id);

  const access = await getYipEventAccess(id);

  return (
    <ParticipantsClient
      eventId={id}
      participants={participants}
      allocationLocked={event.allocation_locked ?? false}
      canDelete={access.canDelete}
    />
  );
}
