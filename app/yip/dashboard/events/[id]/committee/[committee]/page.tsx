import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { CommitteeClient } from "@/app/yip/me/committee/committee-client";
import { AdminCommitteeReport } from "./admin-committee-report";

// Organiser view of a committee's Room — the SAME surface participants use, but
// driven by canManage (no participant session). The organiser can read + edit
// the bill / clauses, assign roles, and resolve amendments; discussion is
// moderated from the event Chat page (the Room links there). Gated fail-closed.
export default async function OrganiserCommitteeRoomPage({
  params,
}: {
  params: Promise<{ id: string; committee: string }>;
}) {
  const { id, committee } = await params;
  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="You don't have access to this committee's room. Your role may not include this event's chapter or region." />
    );
  }
  const committeeName = decodeURIComponent(committee);
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-5">
      <AdminCommitteeReport eventId={id} committeeName={committeeName} />
      <CommitteeClient eventId={id} committeeName={committeeName} />
    </div>
  );
}
