import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { listVolunteers } from "@/app/yip/actions/volunteers";
import { listParties } from "@/app/yip/actions/parties";
import {
  getYuvaAssignments,
  listEventCommittees,
} from "@/app/yip/actions/yuva-assignments";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { YuvaAssignmentsClient } from "./yuva-client";

export default async function YuvaAssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's YUVA desks. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  const [volunteers, parties, committees, assignments] = await Promise.all([
    listVolunteers(id),
    listParties(id),
    listEventCommittees(id),
    getYuvaAssignments(id),
  ]);

  const access = await getYipEventAccess(id);

  // Only YUVA volunteers are eligible desk handlers.
  const yuvaVolunteers = volunteers.filter((v) => v.is_yuva);

  return (
    <YuvaAssignmentsClient
      eventId={id}
      eventName={event.name}
      yuvaVolunteers={yuvaVolunteers.map((v) => ({
        id: v.id,
        full_name: v.full_name,
        phone: v.phone,
      }))}
      parties={parties.map((p) => ({
        id: p.id,
        name: p.name,
        side: p.side,
        party_number: p.party_number,
      }))}
      committees={committees}
      initialAssignments={assignments}
      canManage={access.canManage}
    />
  );
}
