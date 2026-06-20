import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import {
  getSessionRoster,
  getScoringToggleSessions,
} from "@/app/yip/actions/jury-sessions";
import { SessionRosterClient } from "./sessions-roster-client";
import { ScoredSessionsPanel } from "./scored-sessions-panel";
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

  const toggleSessions = await getScoringToggleSessions(id);
  // Key the roster on the scoreable set so it remounts (re-seeds its state)
  // when a session is switched on/off above.
  const rosterKey = roster.data.sessions.map((s) => s.id).join("|");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      {toggleSessions.success && (
        <ScoredSessionsPanel eventId={id} sessions={toggleSessions.data} />
      )}
      <SessionRosterClient
        key={rosterKey}
        eventId={id}
        roster={roster.data}
        embedded
      />
    </div>
  );
}
