import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { listFees, getFeeStats } from "@/app/actions/yip/fees";
import { FeesClient } from "./fees-client";

export default async function FeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, mycii_payment_link, mycii_event_registered, fee_per_participant_inr")
    .eq("id", id)
    .single();

  if (!event) notFound();

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
