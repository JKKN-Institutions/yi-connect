import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent, listCommitteeTopicsForEvent } from "@/app/yip/actions/events";
import { CommitteePickerClient } from "./topics-event-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getCommitteeNumbering } from "@/lib/yip/committee-number";
import { orderEventCommittees } from "@/lib/yip/event-committees";

export default async function EventTopicsPage({
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

  // getEvent returns null when the caller has no access to this event.
  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's committees. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // The official committee catalogue for THIS event's round level
  // (admin-managed at /yip/dashboard/admin/topics): the chapter set for a
  // chapter round, the fifteen regional committees for a regional one.
  const catalog = await listCommitteeTopicsForEvent(id);

  // This event's currently-selected committees = the keys of committee_topics.
  // Read on the service client (yip.events is RLS read-only for `authenticated`,
  // but the column is non-sensitive and the access gate above already passed).
  const service = await createServiceClient();
  // committee_whatsapp arrives in migration 20260814170000 and is not in
  // types/yip/database.ts (never regenerated — the CLI corrupts it), so this
  // one read is cast. Same narrow-accessor pattern as app/yip/actions/voting.ts.
  const { data: row } = await (
    service as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            v: string
          ) => {
            single: () => Promise<{
              data: {
                committee_topics: unknown;
                committee_whatsapp: unknown;
              } | null;
            }>;
          };
        };
      };
    }
  )
    .from("events")
    .select("committee_topics, committee_whatsapp")
    .eq("id", id)
    .single();

  const ct = (row?.committee_topics ?? {}) as
    | Record<string, string>
    | string[]
    | null;
  let initialSelected: string[] = [];
  if (Array.isArray(ct)) initialSelected = ct.map(String);
  else if (ct && typeof ct === "object") initialSelected = Object.keys(ct);

  // The event's committees as NUMBERED slots (1..N). The number is what a
  // student is told at allocation; the ministry is a label attributed to that
  // number later. Ordered with the catalogue so named committees follow the
  // official ministry order rather than jsonb's key order.
  const numbering = await getCommitteeNumbering(service);
  const slots = orderEventCommittees(initialSelected, numbering.numberByName);

  // How many students already sit in each committee — shown per slot so an
  // organiser can see what a rename or a change of count will touch.
  const { data: rows } = await service
    .from("participants")
    .select("committee_number")
    .eq("event_id", id)
    .not("committee_number", "is", null);
  const studentsBySlot: Record<number, number> = {};
  for (const r of rows ?? []) {
    const n = (r as { committee_number: number | null }).committee_number;
    if (n != null) studentsBySlot[n] = (studentsBySlot[n] ?? 0) + 1;
  }

  return (
    <CommitteePickerClient
      eventId={id}
      catalog={catalog}
      initialSelected={initialSelected}
      slots={slots}
      studentsBySlot={studentsBySlot}
      committeeWhatsapp={
        (row?.committee_whatsapp ?? {}) as Record<string, string>
      }
    />
  );
}
