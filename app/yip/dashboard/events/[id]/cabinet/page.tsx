import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
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

  const config = await getCabinetConfig(id);

  return (
    <CabinetClient
      eventId={id}
      initialNames={config.ministries.map((m) => m.label)}
      configured={config.configured}
      defaultCount={MINISTRIES.length}
    />
  );
}
