import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getEventParticipants } from "@/app/yip/actions/participants";
import { getYuvaAssignments } from "@/app/yip/actions/yuva-assignments";
import { getEventScoredCounts } from "@/app/yip/actions/scoring-overview";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { matchesDesk, type DeskAssignment } from "@/lib/yip/yuva-desk";
import { ROUND_LEVEL_LABELS, toRoundLevel } from "@/lib/yip/round-level";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";
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

  // Speech tracking is a CHAPTER-ROUND feature. #1043 hid the tab at other
  // levels, but a bookmark, a shared link or browser history still lands here —
  // so the page has to explain itself instead of opening a roster checklist for
  // a session that was never going to run.
  //
  // NOT a 403, deliberately. The viewer is a legitimate organiser of their own
  // event with full rights; nothing is being denied. A 403 here would misreport
  // the reason and send them chasing an access bug that doesn't exist. Same
  // shape as the Formation page's regional-only notice.
  //
  // Placed AFTER both access checks so someone with no right to this event
  // still gets the access answer — a "wrong round type" reply would leak that
  // the event exists.
  //
  // FAIL CLOSED: toRoundLevel() narrows a missing or unrecognised value to
  // null, and null !== "chapter", so anything we cannot positively identify as
  // a chapter round shows the notice. Never `level && level !== "chapter"` —
  // that shape skips the block on a null level and renders the page.
  const level = toRoundLevel(event.level);
  if (level !== "chapter") {
    return (
      <div className="rounded-xl border border-[#1a1a3e]/10 bg-white p-6 shadow-sm">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAFFRON }}
        >
          Speeches
        </p>
        <h2 className="mt-1 text-lg font-bold" style={{ ...SERIF, color: INK }}>
          Not part of this round
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[#1a1a3e]/60">
          Speech tracking is only used at <strong>Chapter Round</strong> events
          {level ? ` (this event is a ${ROUND_LEVEL_LABELS[level]} round)` : ""}.
          The 90-second delegate speech is a chapter-round format — regional and
          national agendas don&apos;t carry it, so there is nothing to track
          here.
        </p>
      </div>
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
