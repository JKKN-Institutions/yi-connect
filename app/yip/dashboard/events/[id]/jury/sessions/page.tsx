import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getSessionRoster } from "@/app/yip/actions/jury-sessions";
import { SessionRosterClient } from "./sessions-roster-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function JurySessionsPage({
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
      <Forbidden403 reason="You don't have access to this event's jury sessions. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const roster = await getSessionRoster(id);
  if (!roster.success) {
    return <Forbidden403 reason={roster.error} />;
  }

  return <SessionRosterClient eventId={id} roster={roster.data} />;
}
