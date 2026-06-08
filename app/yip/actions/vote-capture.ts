"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireVolunteerSession } from "@/lib/yip/auth/yip-session";
import { validateVoteValue } from "@/lib/yip/vote-validate";

/**
 * Floor-voting kiosk capture actions.
 *
 * YUVA volunteers carry a device around the house during an OPEN vote session.
 * They surface the list of students who have not yet voted, hand the device to
 * a student, and relay that student's self-cast vote — stamping provenance
 * (entry_method: "volunteer_kiosk", recorded_by_volunteer_id).
 *
 * Every export is gated by requireVolunteerSession(eventId): the underlying
 * yip.votes table has INSERT policies open to `public`, so the server action is
 * the only authorization layer. Votes are FINAL — these actions INSERT only and
 * never UPDATE an existing vote (mirrors the house castVote finality).
 */

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface KioskOption {
  value: string;
  label: string;
}

interface KioskActive {
  sessionId: string;
  voteType: string;
  title: string;
  options: KioskOption[];
}

interface KioskPendingVoter {
  participantId: string;
  serialNo: number | null;
  fullName: string;
  constituencyName: string | null;
}

interface KioskTurnout {
  cast: number;
  eligible: number;
}

interface KioskState {
  active: KioskActive | null;
  pending: KioskPendingVoter[];
  turnout: KioskTurnout;
}

// ─── Get Kiosk State ────────────────────────────────────────────

export async function getKioskState(
  eventId: string
): Promise<ActionResult<KioskState>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  // The event's currently-open vote session (if any).
  const { data: voteSession } = await supabase
    .from("vote_sessions")
    .select("id, agenda_item_id, vote_type, bill_id, config, status")
    .eq("event_id", eventId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // No open session → nothing to vote on; turnout is zero against the roster.
  if (!voteSession) {
    const { count: eligible } = await supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    return {
      success: true,
      data: {
        active: null,
        pending: [],
        turnout: { cast: 0, eligible: eligible ?? 0 },
      },
    };
  }

  // Build the option set for the active session.
  let title = "";
  let options: KioskOption[] = [];

  if (voteSession.vote_type === "bill_vote") {
    title = "Bill Vote";
    if (voteSession.bill_id) {
      const { data: bill } = await supabase
        .from("bills")
        .select("title")
        .eq("id", voteSession.bill_id)
        .maybeSingle();
      if (bill?.title) title = bill.title;
    }
    // Mirror the self-cast bill vote_value strings (app/yip/me/vote/page.tsx):
    // "aye" / "nay" / "abstain". The house revealResults only counts these,
    // so kiosk votes MUST use the same strings to be tallied.
    options = [
      { value: "aye", label: "AYE" },
      { value: "nay", label: "NO" },
      { value: "abstain", label: "ABSTAIN" },
    ];
  } else if (voteSession.vote_type === "speaker_election") {
    title = "Speaker Election";
    const config = (voteSession.config ?? {}) as { candidateIds?: unknown };
    const candidateIds = Array.isArray(config.candidateIds)
      ? config.candidateIds.filter((c): c is string => typeof c === "string")
      : [];

    if (candidateIds.length > 0) {
      const { data: candidates } = await supabase
        .from("participants")
        .select("id, full_name, serial_no")
        .eq("event_id", eventId)
        .in("id", candidateIds);

      const byId = new Map(
        (candidates ?? []).map((c) => [c.id, c])
      );
      // Preserve the config-declared candidate order.
      options = candidateIds
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({
          value: c.id,
          label: `#${c.serial_no ?? "—"} · ${c.full_name}`,
        }));
    }
  } else {
    title = "Vote";
  }

  const agendaItemId = voteSession.agenda_item_id;

  // Roster + the ids that have already voted for this agenda item.
  const [{ data: roster }, { data: castVotes }] = await Promise.all([
    supabase
      .from("participants")
      .select("id, full_name, serial_no, constituency_name")
      .eq("event_id", eventId)
      .order("serial_no", { ascending: true, nullsFirst: false }),
    supabase
      .from("votes")
      .select("participant_id")
      .eq("agenda_item_id", agendaItemId),
  ]);

  const votedIds = new Set(
    (castVotes ?? []).map((v) => v.participant_id)
  );

  const pending: KioskPendingVoter[] = (roster ?? [])
    .filter((p) => !votedIds.has(p.id))
    .map((p) => ({
      participantId: p.id,
      serialNo: p.serial_no,
      fullName: p.full_name,
      constituencyName: p.constituency_name,
    }));

  return {
    success: true,
    data: {
      active: {
        sessionId: voteSession.id,
        voteType: voteSession.vote_type,
        title,
        options,
      },
      pending,
      turnout: {
        cast: votedIds.size,
        eligible: (roster ?? []).length,
      },
    },
  };
}

// ─── Cast Kiosk Vote ────────────────────────────────────────────

export async function castKioskVote(
  eventId: string,
  sessionId: string,
  participantId: string,
  voteValue: string
): Promise<ActionResult<{ status: "success" | "already_voted" | "closed" }>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  // Re-fetch the session server-side — never trust the client's claim that it
  // is open or belongs to this event.
  const { data: voteSession } = await supabase
    .from("vote_sessions")
    .select("id, event_id, agenda_item_id, vote_type, status, config")
    .eq("id", sessionId)
    .maybeSingle();

  if (!voteSession || voteSession.event_id !== eventId) {
    return { success: false, error: "Vote session not found" };
  }

  if (voteSession.status !== "open") {
    return { success: true, data: { status: "closed" } };
  }

  // Reject junk / non-candidate values before they pollute the tally.
  const valid = validateVoteValue(voteSession, voteValue);
  if (!valid.ok) return { success: false, error: valid.error };

  // Verify the participant belongs to this event before recording on their behalf.
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!participant) {
    return { success: false, error: "Student not found for this event" };
  }

  // INSERT-ONLY. A repeat is mapped to already_voted via the unique constraint;
  // we never update an existing vote.
  const { error } = await supabase.from("votes").insert({
    event_id: eventId,
    agenda_item_id: voteSession.agenda_item_id,
    participant_id: participantId,
    vote_type: voteSession.vote_type,
    vote_value: voteValue,
    entry_method: "volunteer_kiosk",
    recorded_by_volunteer_id: session.volunteerId,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: true, data: { status: "already_voted" } };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: { status: "success" } };
}
