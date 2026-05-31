import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { listVolunteers } from "@/app/yip/actions/volunteers";
import { VolunteersClient } from "./volunteers-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function VolunteersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's volunteers. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const volunteers = await listVolunteers(id);

  const access = await getYipEventAccess(id);

  return (
    <VolunteersClient
      eventId={id}
      eventName={event.name}
      initialVolunteers={volunteers}
      canDelete={access.canDelete}
    />
  );
}
