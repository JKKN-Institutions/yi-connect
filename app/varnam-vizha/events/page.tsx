import type { Metadata } from "next";
import Link from "next/link";
import {
  getCurrentEdition,
  getEditionEvents,
  type FestivalEvent,
} from "@/lib/varnam/data/editions";

export const metadata: Metadata = { title: "Events" };

function fmtDay(iso: string | null): { d: string; m: string; full: string } {
  if (!iso) return { d: "–", m: "", full: "Date to be announced" };
  const dt = new Date(iso);
  return {
    d: dt.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }),
    m: dt.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }),
    full: dt.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone: "Asia/Kolkata",
    }),
  };
}

function categoryChip(cat: string | null): string {
  switch (cat) {
    case "sports":
      return "bg-[#0CA4A5]/10 text-[#0a8485]";
    case "cultural":
      return "bg-[#D6336C]/10 text-[#b02a59]";
    default:
      return "bg-[#3B0A45]/10 text-[#3B0A45]";
  }
}

function EventCard({ e }: { e: FestivalEvent }) {
  const day = fmtDay(e.start_date);
  const href = e.public_slug ? `/varnam-vizha/events/${e.public_slug}` : undefined;
  const body = (
    <article className="group flex h-full gap-4 rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm transition hover:border-[#D6336C]/40 hover:shadow-md">
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#F4A300] to-[#D6336C] text-white">
        <span className="font-[family-name:var(--font-vv-display)] text-2xl font-bold leading-none">
          {day.d}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {day.m}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${categoryChip(
              e.category
            )}`}
          >
            {e.category ?? "event"}
          </span>
          {e.is_featured && (
            <span className="rounded-full bg-[#F4A300]/15 px-2 py-0.5 text-[11px] font-semibold text-[#a06a00]">
              ★ Featured
            </span>
          )}
        </div>
        <h3 className="font-[family-name:var(--font-vv-display)] text-lg font-bold leading-tight text-[#3B0A45] group-hover:text-[#D6336C]">
          {e.title}
        </h3>
        {e.venue_address && (
          <p className="mt-0.5 text-sm text-[#2B0A33]/55">{e.venue_address}</p>
        )}
        {e.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-[#2B0A33]/70">
            {e.description}
          </p>
        )}
      </div>
    </article>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function VarnamEventsPage() {
  const edition = await getCurrentEdition();
  const events = edition ? await getEditionEvents(edition.id) : [];

  const range =
    edition?.start_date && edition?.end_date
      ? `${fmtDay(edition.start_date).full} – ${fmtDay(edition.end_date).full}`
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D6336C]">
          {edition ? edition.name : "Varnam Vizha"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-4xl font-extrabold text-[#3B0A45] sm:text-5xl">
          The Programme
        </h1>
        {/* TAMIL: needs native review */}
        <p
          lang="ta"
          className="mt-1 font-[family-name:var(--font-vv-display)] text-xl font-semibold text-[#D6336C]"
        >
          நிகழ்ச்சி நிரல்
        </p>
        {range && <p className="mt-2 text-[#2B0A33]/70">{range}</p>}
        {edition?.theme && (
          <p className="mt-1 text-sm italic text-[#2B0A33]/60">{edition.theme}</p>
        )}
        {edition?.summary && (
          <p className="mx-auto mt-4 max-w-2xl text-sm text-[#2B0A33]/70">
            {edition.summary}
          </p>
        )}
      </header>

      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#3B0A45]/20 bg-white p-10 text-center text-[#2B0A33]/60">
          The programme is being finalised. Check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      )}

      <p className="mt-10 text-center">
        <Link
          href="/varnam-vizha"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
