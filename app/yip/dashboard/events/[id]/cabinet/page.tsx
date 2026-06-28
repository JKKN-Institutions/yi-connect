import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { listCommitteeTopics } from "@/app/yip/actions/events";
import { MINISTRIES } from "@/lib/yip/constants";
import { CabinetClient } from "./cabinet-client";

export default async function CabinetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="You don't have access to manage this event's cabinet settings." />
    );
  }

  const [config, catalog] = await Promise.all([
    getCabinetConfig(id),
    // The same official ministry/committee catalogue the Committees tab uses.
    listCommitteeTopics(),
  ]);

  return (
    <CabinetClient
      eventId={id}
      catalog={catalog}
      // Pre-tick the cabinet posts already chosen for THIS event. When the event
      // is on the default cabinet (unconfigured), start with nothing ticked —
      // the default names don't map to catalogue rows, so the organiser picks.
      initialSelected={
        config.configured ? config.ministries.map((m) => m.label) : []
      }
      defaultCount={MINISTRIES.length}
    />
  );
}
