import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import {
  getManagedEvent,
  toISTDateTimeLocal,
} from "@/lib/varnam/data/manage-events-data";
import { EventForm, type EventFormInitial } from "../../EventForm";
import { CancelEventButton } from "./CancelEventButton";

export const metadata: Metadata = { title: "Edit event" };

type Params = { params: Promise<{ id: string }> };

function statusChip(status: string | null): string {
  switch (status) {
    case "published":
      return "bg-[#0CA4A5]/10 text-[#0a8485]";
    case "cancelled":
      return "bg-[#D6336C]/10 text-[#b02a59]";
    default:
      return "bg-[#3B0A45]/8 text-[#3B0A45]/70";
  }
}

export default async function EditEventPage({ params }: Params) {
  const { id } = await params;
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;
  if (!access.canManage)
    return (
      <Forbidden403 reason="Your role can view the dashboard but not edit events. Ask the festival chair for organiser access." />
    );

  const event = await getManagedEvent(id);
  if (!event || !event.festival_edition_id) notFound();

  const cf = event.custom_fields ?? {};
  const initial: EventFormInitial = {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    category: event.category ?? "cultural",
    startsAtLocal: toISTDateTimeLocal(event.start_date),
    endsAtLocal: toISTDateTimeLocal(event.end_date),
    venueAddress: event.venue_address ?? "",
    maxCapacity: event.max_capacity != null ? String(event.max_capacity) : "",
    waitlistEnabled: event.waitlist_enabled ?? false,
    isFeatured: event.is_featured ?? false,
    isPaid: cf.paid === true,
    ticketUrl: typeof cf.ticket_url === "string" ? cf.ticket_url : "",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            Edit event
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[#2B0A33]/60">
            <span className="truncate">{event.title}</span>
            <span
              className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusChip(
                event.status
              )}`}
            >
              {event.status ?? "draft"}
            </span>
          </p>
        </div>
        <CancelEventButton eventId={event.id} status={event.status} />
      </div>

      <EventForm mode="edit" initial={initial} />
    </div>
  );
}
