"use server";

// Full participant profile for the roster row-click detail page.
//
// A `participant` row is one student's participation in ONE event. The
// person-level identity lives in `yip.contestants` (linked via
// participants.person_id) and is meant to be the SAME profile reused across
// chapter / regional / national. Where a student is linked across events, we
// surface that cross-level history; today most rosters aren't linked yet, so
// the cross-level section is simply empty for them.
//
// Gated through getYipEventAccess (canView) like the rest of the event pages;
// the privileged read then runs on the service client (yip.* is RLS
// read-only for `authenticated`).

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

export type ParticipantProfileRow = {
  id: string;
  event_id: string;
  full_name: string;
  school_name: string | null;
  class: number | null;
  section: string | null;
  phone: string | null;
  email: string | null;
  parent_phone: string | null;
  city: string | null;
  home_state: string | null;
  access_code: string | null;
  party_side: string | null;
  party_number: number | null;
  parliament_role: string | null;
  ministry: string | null;
  constituency_name: string | null;
  constituency_number: number | null;
  constituency_state: string | null;
  committee_name: string | null;
  checked_in: boolean | null;
  checked_in_at: string | null;
  qualified_for_next: boolean | null;
  serial_no: number | null;
  person_id: string | null;
  created_at: string | null;
};

export type ContestantProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  parent_phone: string | null;
  class: number | null;
  section: string | null;
  school_name: string | null;
  home_state: string | null;
  city: string | null;
  photo_url: string | null;
  bio: string | null;
  notes: string | null;
};

export type CrossLevelParticipation = {
  participant_id: string;
  event_id: string;
  event_name: string;
  level: string | null;
  parliament_role: string | null;
  party_side: string | null;
  qualified_for_next: boolean | null;
};

export type ParticipantProfile = {
  participant: ParticipantProfileRow;
  contestant: ContestantProfile | null;
  crossLevel: CrossLevelParticipation[];
  canManage: boolean;
};

const PARTICIPANT_COLUMNS =
  "id, event_id, full_name, school_name, class, section, phone, email, parent_phone, city, home_state, access_code, party_side, party_number, parliament_role, ministry, constituency_name, constituency_number, constituency_state, committee_name, committee_number, checked_in, checked_in_at, qualified_for_next, serial_no, person_id, created_at";

export async function getParticipantProfile(
  eventId: string,
  participantId: string
): Promise<ParticipantProfile | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  const { data: participant } = await svc
    .from("participants")
    .select(PARTICIPANT_COLUMNS)
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!participant) return null;

  let contestant: ContestantProfile | null = null;
  let crossLevel: CrossLevelParticipation[] = [];

  const personId = participant.person_id;
  if (personId) {
    const { data: c } = await svc
      .from("contestants")
      .select(
        "id, full_name, phone, email, parent_phone, class, section, school_name, home_state, city, photo_url, bio, notes"
      )
      .eq("id", personId)
      .maybeSingle();
    contestant = (c as ContestantProfile | null) ?? null;

    // Every OTHER participation of the same person — i.e. the same student at
    // other levels/events. Two cheap queries (rows, then their events) avoids
    // embed-cardinality typing pitfalls.
    const { data: others } = await svc
      .from("participants")
      .select("id, event_id, parliament_role, party_side, qualified_for_next")
      .eq("person_id", personId)
      .neq("id", participantId);

    const otherList = others ?? [];
    if (otherList.length > 0) {
      const eventIds = [...new Set(otherList.map((o) => o.event_id))];
      const { data: evs } = await svc
        .from("events")
        .select("id, name, level")
        .in("id", eventIds);
      const evMap = new Map((evs ?? []).map((e) => [e.id, e]));
      crossLevel = otherList.map((o) => {
        const ev = evMap.get(o.event_id);
        return {
          participant_id: o.id,
          event_id: o.event_id,
          event_name: ev?.name ?? "Event",
          level: ev?.level ?? null,
          parliament_role: o.parliament_role,
          party_side: o.party_side,
          qualified_for_next: o.qualified_for_next,
        };
      });
    }
  }

  return {
    participant: participant as ParticipantProfileRow,
    contestant,
    crossLevel,
    canManage: access.canManage,
  };
}
