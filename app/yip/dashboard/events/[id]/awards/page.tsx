import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getEventAwardConfig } from "@/app/yip/actions/admin-awards";
import { EventAwardConfig } from "../results/event-award-config";

export const dynamic = "force-dynamic";

export default async function EventAwardsPage({
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
      <Forbidden403 reason="You don't have access to this event's awards. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }
  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Only this event's organisers can set up awards." />
    );
  }

  const config = await getEventAwardConfig(id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-[#1a1a3e]">
          Awards for this event
        </h1>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">
          Choose how many students each award recognises at this event — raise
          the count to recognise more — or turn an award off for this event.
          Anything you leave alone uses the national default. Changes apply the
          next time results are computed. The national team sets the default list
          and each award&apos;s basis under Admin → Awards.
        </p>
      </div>
      <EventAwardConfig eventId={id} initialConfig={config} defaultOpen />
    </div>
  );
}
