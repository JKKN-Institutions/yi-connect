import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { listParties } from "@/app/yip/actions/parties";
import { PartiesClient } from "./parties-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { benchWhatsappFor } from "@/lib/yip/whatsapp-links";

export default async function PartiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(eventId);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's parties. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  const supabase = await createServiceClient();

  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, school_name, party_side, party_id, parliament_role")
    .eq("event_id", eventId)
    .order("full_name");

  const parties = await listParties(eventId);

  // The two bench WhatsApp groups. events.bench_whatsapp is newer than
  // types/yip/database.ts (never regenerated - the CLI corrupts it), so it is
  // read through a narrow cast, the same pattern committee_whatsapp uses on the
  // Committees tab. A missing column simply yields no links rather than an error.
  const { data: benchRow } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: { bench_whatsapp: unknown } | null;
            }>;
          };
        };
      };
    }
  )
    .from("events")
    .select("bench_whatsapp")
    .eq("id", eventId)
    .maybeSingle();

  const access = await getYipEventAccess(eventId);

  return (
    <PartiesClient
      eventId={eventId}
      eventName={event.name}
      initialParties={parties}
      participants={participants ?? []}
      canDelete={access.canDelete}
      canManage={access.canManage}
      allocationLocked={event.allocation_locked ?? false}
      benchWhatsapp={{
        ruling: benchWhatsappFor(benchRow?.bench_whatsapp, "ruling"),
        opposition: benchWhatsappFor(benchRow?.bench_whatsapp, "opposition"),
      }}
    />
  );
}
