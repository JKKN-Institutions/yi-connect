import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getScoresForJury,
  getSessionScoringParams,
} from "@/app/yip/actions/scoring";
import { HistoryClient } from "./history-client";

interface JurySession {
  type: "jury";
  id: string;
  name: string;
  eventId: string;
}

function parseJurySession(raw: string | undefined): JurySession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "jury" && parsed.id && parsed.name && parsed.eventId) {
      return parsed as JurySession;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function JuryHistoryPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yip_session")?.value;
  const session = parseJurySession(raw);

  if (!session) {
    redirect("/yip/join");
  }

  const scores = await getScoresForJury(session.id, session.eventId);

  // Resolve each session's max SERVER-SIDE so the History list shows the correct
  // per-session denominator (15/20/10) on first paint — no client fallback flash.
  const distinctAgendaIds = Array.from(
    new Set(
      scores
        .map((s) => s.agenda_item_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const maxEntries = await Promise.all(
    distinctAgendaIds.map(async (id) => {
      const params = await getSessionScoringParams(id);
      return [id, params?.total_max] as const;
    })
  );
  const sessionMaxById: Record<string, number> = {};
  for (const [id, max] of maxEntries) {
    if (typeof max === "number") sessionMaxById[id] = max;
  }

  return (
    <HistoryClient
      scores={scores}
      sessionMaxById={sessionMaxById}
      juryAssignmentId={session.id}
      eventId={session.eventId}
    />
  );
}
