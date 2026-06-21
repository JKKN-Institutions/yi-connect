import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getEventParticipants } from "@/app/yip/actions/participants";
import { getYuvaAssignments } from "@/app/yip/actions/yuva-assignments";
import { getEventScoredCounts } from "@/app/yip/actions/scoring-overview";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { matchesDesk, type DeskAssignment } from "@/lib/yip/yuva-desk";
import { SpeechesClient } from "./speeches-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function SpeechesPage({
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
      <Forbidden403 reason="You don't have access to this event. It may have been deleted, or your role may not include its chapter or region." />
    );
  }

  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Only event organisers can track speeches for this event." />
    );
  }

  // Gated service-role reads (each action re-checks access, so they stay
  // scoped). Roster + volunteer-desk coverage + jury-scoring tally in parallel.
  const [participants, assignments, scoredCounts] = await Promise.all([
    getEventParticipants(id),
    getYuvaAssignments(id),
    getEventScoredCounts(id),
  ]);

  // Volunteer-desk scope: a delegate is "covered" when some YUVA volunteer's
  // assignment (party or committee) includes them — i.e. a volunteer can mark
  // their speech/check-in from the desk. Reuses the same matchesDesk logic the
  // desk itself uses, so coverage here matches the desk exactly.
  const deskAssignments: DeskAssignment[] = assignments.map((a) => ({
    party_id: a.party_id,
    committee_name: a.committee_name,
  }));
  const hasVolunteers = deskAssignments.length > 0;

  const roster = participants.map((p) => {
    const row = p as {
      party_id?: string | null;
      committee_name?: string | null;
      speech_finished?: boolean | null;
    };
    return {
      id: p.id,
      full_name: p.full_name,
      party_number: p.party_number,
      constituency_number: p.constituency_number,
      speech_finished: !!row.speech_finished,
      covered:
        hasVolunteers &&
        matchesDesk(
          {
            party_id: row.party_id ?? null,
            committee_name: row.committee_name ?? null,
          },
          deskAssignments
        ),
      scoredJurors: scoredCounts[p.id] ?? 0,
    };
  });

  return (
    <SpeechesClient
      eventId={id}
      eventName={event.name}
      roster={roster}
      hasVolunteers={hasVolunteers}
    />
  );
}
