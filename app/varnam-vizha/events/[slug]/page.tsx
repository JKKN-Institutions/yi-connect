import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { getEventBySlug } from "@/lib/varnam/data/editions";
import { RegisterForm } from "./RegisterForm";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const found = await getEventBySlug(slug);
  return { title: found ? found.event.title : "Event" };
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "Date to be announced";
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  };
  const s = new Date(start);
  const day = s.toLocaleDateString("en-IN", opts);
  const t = (d: Date) =>
    d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  const time = end ? `${t(s)} – ${t(new Date(end))}` : t(s);
  return `${day} · ${time}`;
}

export default async function VarnamEventDetail({ params }: Params) {
  const { slug } = await params;
  const found = await getEventBySlug(slug);
  if (!found) notFound();
  const { event, edition } = found;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/varnam-vizha/events"
        className="text-sm font-medium text-[#0CA4A5] hover:underline"
      >
        ← All events
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#F4A300] via-[#D6336C] to-[#3B0A45] px-6 py-8 text-white sm:px-10 sm:py-12">
          {edition && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              {edition.name}
            </p>
          )}
          <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-3xl font-extrabold leading-tight sm:text-4xl">
            {event.title}
          </h1>
          {event.category && (
            <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold capitalize">
              {event.category}
            </span>
          )}
        </div>

        <div className="space-y-5 px-6 py-8 sm:px-10">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-[#D6336C]" />
            <p className="text-sm font-medium text-[#2B0A33]">
              {fmtRange(event.start_date, event.end_date)}
            </p>
          </div>
          {event.venue_address && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-[#D6336C]" />
              <p className="text-sm font-medium text-[#2B0A33]">
                {event.venue_address}
              </p>
            </div>
          )}
          {event.description && (
            <p className="border-t border-[#3B0A45]/10 pt-5 text-[#2B0A33]/80">
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <RegisterForm eventId={event.id} />
      </div>
    </div>
  );
}
