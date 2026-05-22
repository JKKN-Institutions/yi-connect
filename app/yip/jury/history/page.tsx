import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getScoresForJury } from "@/app/actions/scoring";
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

  return (
    <HistoryClient
      scores={scores}
      juryAssignmentId={session.id}
      eventId={session.eventId}
    />
  );
}
