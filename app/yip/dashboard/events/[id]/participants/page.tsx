import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getEventParticipants } from "@/app/yip/actions/participants";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { ParticipantsClient } from "./participants-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function ParticipantsPage({
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
      <Forbidden403 reason="You don't have access to this event's participants. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Fetch participants via the gated service-role action. The roster includes
  // access_code + PII; migration 20260609000000 revokes those columns from the
  // `authenticated` role, so this read must go through service_role (the action
  // re-checks getYipEventAccess().canManage, so it stays event-scoped).
  const participants = await getEventParticipants(id);

  const access = await getYipEventAccess(id);

  // The event's effective cabinet portfolios — drive the Ministry dropdown in
  // the participant editor (a minister can hold a per-event custom portfolio,
  // not just the static 8).
  const { ministries } = await getCabinetConfig(id);

  // The scored agenda session that marks the officials of the House (Speaker,
  // Deputies, Journalists, Administrators) on the duty-roles sheet — named on
  // the bench banner so organisers know these benchless students ARE marked.
  let officialsSession: { day: number | null; title: string } | null = null;
  if (access.canView) {
    const svc = await createServiceClient();
    const { data: dutyItems } = await svc
      .from("agenda")
      .select("day, title, sequence_order")
      .eq("event_id", id)
      .eq("is_scoreable", true)
      .or("session_key.eq.national_duty_roles,agenda_type.eq.closing_remarks")
      .order("day", { ascending: true })
      .order("sequence_order", { ascending: true })
      .limit(1);
    const first = dutyItems?.[0];
    if (first) officialsSession = { day: first.day ?? null, title: first.title };
  }

  // The balancing field is collected only to spread parties + committees and is
  // NEVER shown in the platform — strip it from the client payload entirely (the
  // roster export reads it server-side; it is purged only when the event's PII is
  // removed at close-out).
  const safeParticipants = participants.map((p) => ({ ...p, school_name: "" }));

  return (
    <ParticipantsClient
      eventId={id}
      eventName={event.name ?? ""}
      participants={safeParticipants}
      allocationLocked={event.allocation_locked ?? false}
      canDelete={access.canDelete}
      canManage={access.canManage}
      canEdit={access.canDelete}
      ministries={ministries}
      officialsSession={officialsSession}
    />
  );
}
