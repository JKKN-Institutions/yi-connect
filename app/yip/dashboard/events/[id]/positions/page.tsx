import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { PositionsAssignmentCard } from "@/components/yip/positions-assignment-card";
import {
  getParticipantsByRole,
  getAllEventParticipants,
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
  const [positionGroups, allParticipants] = await Promise.all([
    getParticipantsByRole(id),
    getAllEventParticipants(id),
  ]);

  return (
    <div className="space-y-4">
      <PositionsAssignmentCard
        groups={positionGroups}
        allParticipants={allParticipants}
      />
    </div>
  );
}
