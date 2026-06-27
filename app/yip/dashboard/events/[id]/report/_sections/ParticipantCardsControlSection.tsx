import "server-only";

/**
 * Server wrapper that gathers the "X of N ready" status for the chair's Day-2
 * AI recap card control and renders the client toggle (ParticipantCardsControl).
 *
 * Mounted on the report toolbar (canManage only). Renders nothing when the
 * caller is not a manager — the report page already gates canView, and this
 * extra check keeps the control invisible to read-only viewers.
 *
 * Counts are derived purely from the drafts layer + a participant count; no
 * scores are read. "ready" here means participant_story drafts in a showable
 * state (ready/approved), matching the YourDayInTheHouseCard gate.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  listAiDraftsForEvent,
  getEventAiEnabled,
} from "@/lib/yip/ai/drafts";
import { ParticipantCardsControl } from "./ParticipantCardsControl";

export async function ParticipantCardsControlSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  if (!canManage) return null;

  const svc = await createServiceClient();
  const [{ count: totalCount }, drafts, aiEnabled] = await Promise.all([
    svc
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    listAiDraftsForEvent(eventId),
    getEventAiEnabled(eventId),
  ]);

  const readyCount = drafts.filter(
    (d) =>
      d.kind === "participant_story" &&
      (d.status === "ready" || d.status === "approved")
  ).length;

  return (
    <ParticipantCardsControl
      eventId={eventId}
      initialEnabled={aiEnabled}
      readyCount={readyCount}
      totalCount={totalCount ?? 0}
    />
  );
}

export default ParticipantCardsControlSection;
