import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import {
  getScoresForJury,
  getSessionScoringParams,
} from "@/app/yip/actions/scoring";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { eventPrivacyMasked } from "@/lib/yip/pii";
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
  const session = await getYipSession();

  if (!session || session.type !== "jury") {
    redirect("/yip/join");
  }

  const scores = await getScoresForJury(session.id, session.eventId);

  // DPDP: privacy-mode events show pseudonyms instead of real names to jurors.
  const supabase = await createServiceClient();
  const { data: privacyEvent } = await supabase
    .from("events")
    .select("privacy_mode, pii_purged_at")
    .eq("id", session.eventId)
    .single();
  const masked = privacyEvent ? eventPrivacyMasked(privacyEvent) : false;

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
      masked={masked}
    />
  );
}
