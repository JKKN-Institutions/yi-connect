import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { PositionsAssignmentCard } from "@/components/yip/positions-assignment-card";
import { PartyLeadersCard } from "@/components/yip/party-leaders-card";
import { CommitteeChairsCard } from "@/components/yip/committee-chairs-card";
import { CommitteeMinistersCard } from "@/components/yip/committee-ministers-card";
import {
  getParticipantsByRole,
  getAllEventParticipants,
  getPartyLeaders,
  getCommitteeChairs,
  getCommitteeMinisters,
} from "@/app/yip/actions/positions";

export default async function PositionsPage({
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

  // getEvent is the single source of truth for event view-access (returns null
  // when the caller isn't an organiser/regional/super-admin for this event), so
  // a null event means deny — render an explicit 403, never a silent redirect.
  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's positions. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Position-bonus assignment data. Moved off the Control panel onto its own tab
  // so role assignment has room to breathe and is reachable at any event status.
  const [
    positionGroups,
    allParticipants,
    partyLeaders,
    committeeChairs,
    committeeMinisters,
  ] = await Promise.all([
    getParticipantsByRole(id),
    getAllEventParticipants(id),
    getPartyLeaders(id),
    getCommitteeChairs(id),
    getCommitteeMinisters(id),
  ]);

  return (
    <div className="space-y-4">
      <PositionsAssignmentCard
        groups={positionGroups}
        allParticipants={allParticipants}
      />
      <PartyLeadersCard data={partyLeaders} />
      <CommitteeMinistersCard data={committeeMinisters} eventId={id} />
      <CommitteeChairsCard data={committeeChairs} />
    </div>
  );
}
