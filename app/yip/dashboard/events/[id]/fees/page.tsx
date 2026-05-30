import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { listFees, getFeeStats } from "@/app/yip/actions/fees";
import { FeesClient } from "./fees-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function FeesPage({
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
      <Forbidden403 reason="You don't have access to this event's fees. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const supabase = await createServiceClient();

  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, school_name, class, phone")
    .eq("event_id", id)
    .order("full_name");

  const [fees, stats] = await Promise.all([listFees(id), getFeeStats(id)]);

  return (
    <FeesClient
      eventId={id}
      eventName={event.name}
      mycii_payment_link={event.mycii_payment_link}
      mycii_event_registered={event.mycii_event_registered ?? false}
      fee_per_participant_inr={event.fee_per_participant_inr ?? 399}
      participants={participants ?? []}
      initialFees={fees}
      initialStats={stats}
    />
  );
}
