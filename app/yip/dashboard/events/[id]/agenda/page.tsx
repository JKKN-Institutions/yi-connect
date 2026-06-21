import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getAgendaForSetup, getAgendaScoreCounts } from "@/app/yip/actions/agenda";
import { listPresetsForEvent } from "@/app/yip/actions/agenda-presets";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { AgendaSetupClient } from "./agenda-setup-client";
import type { Tables } from "@/types/yip/database";

type AgendaItem = Tables<{ schema: "yip" }, "agenda">;

export default async function AgendaSetupPage({
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
      <Forbidden403 reason="You don't have access to this event's agenda. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Only this event's organisers can set up the agenda." />
    );
  }

  const [items, scoreCounts, presets] = (await Promise.all([
    getAgendaForSetup(id),
    getAgendaScoreCounts(id),
    listPresetsForEvent(id),
  ])) as [
    AgendaItem[],
    Record<string, number>,
    Awaited<ReturnType<typeof listPresetsForEvent>>,
  ];
  const isLive = event.status === "day1_live" || event.status === "day2_live";

  // deleteAgendaItem only allows chair/national — match the button visibility to
  // the actual server gate so no role sees a Delete button that always errors.
  const canDelete =
    access.role === "super_admin" || access.role === "chapter_admin";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <AgendaSetupClient
        eventId={id}
        items={items}
        scoreCounts={scoreCounts}
        presets={presets}
        canDelete={canDelete}
        isLive={isLive}
      />
    </div>
  );
}
