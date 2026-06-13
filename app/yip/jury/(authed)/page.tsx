import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { JuryScoringClient } from "./jury-scoring-client";

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

export default async function JuryScoringPage() {
  const session = await getYipSession();

  if (!session || session.type !== "jury") {
    redirect("/yip/join");
  }

  // Fetch event-level lock state so the jury UI can refuse writes at the
  // form level instead of silently failing on submit. The server action
  // also enforces this — this is a UX-level guard to match.
  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("scores_locked")
    .eq("id", session.eventId)
    .single();

  return (
    <JuryScoringClient
      juryAssignmentId={session.id}
      juryName={session.name}
      eventId={session.eventId}
      initialEventLocked={event?.scores_locked === true}
    />
  );
}
