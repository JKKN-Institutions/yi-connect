import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { publishNationalEvent } from "@/app/yi-future/actions/host-events";

async function getStats(eventId: string | null) {
  const svc = await createServiceClient();

  if (!eventId) {
    return { partners: 0, slots: 0, interviews: 0, government: 0, finalists: 0 };
  }

  const [partners, interviews, government, finalists, slotsData] = await Promise.all([
    svc
      .schema("future")
      .from("corporate_partners")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    svc
      .schema("future")
      .from("interview_slots")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    svc
      .schema("future")
      .from("government_engagements")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    svc
      .schema("future")
      .from("advancements")
      .select("team_id", { count: "exact", head: true })
      .eq("to_event_id", eventId),
    svc
      .schema("future")
      .from("internship_slots")
      .select("slots_available, corporate_partners!inner(event_id)")
      .eq("corporate_partners.event_id", eventId),
  ]);

  const slots = ((slotsData.data as unknown as {
    slots_available: number | null;
  }[]) ?? []).reduce((s, r) => s + (r.slots_available ?? 0), 0);

  return {
    partners: partners.count ?? 0,
    slots,
    interviews: interviews.count ?? 0,
    government: government.count ?? 0,
    finalists: finalists.count ?? 0,
  };
}

export default async function HostDashboard() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");

  if (!ctx.isHost) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-navy/10 rounded-lg p-8 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <h2 className="text-xl font-bold text-navy">
          Not a host chapter
        </h2>
        <p className="mt-3 text-sm text-navy/60">
          This chapter ({ctx.chapterName}) isn&apos;t currently assigned as a
          host for any track in {ctx.editionName}. Yi National admin can
          change this in Host Assignments.
        </p>
        <Link
          href="/yi-future/chapter"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back to chapter
        </Link>
      </div>
    );
  }

  if (!ctx.nationalEvent) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy">Host chapter</h2>
          <p className="mt-1 text-sm text-navy/60">
            {ctx.chapterName} ·{" "}
            <span className="inline-flex items-center gap-1">
              {ctx.trackIcon ?? "•"} {ctx.trackName ?? "No track"}
            </span>
          </p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">🏛️</div>
          <h3 className="text-lg font-bold text-navy">
            No National Track Final scheduled yet
          </h3>
          <p className="mt-2 text-sm text-navy/60">
            Create the 2-day national event to start planning.
          </p>
          <Link
            href="/yi-future/host/event/new"
            className="mt-4 inline-block px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Schedule national event →
          </Link>
        </div>
      </div>
    );
  }

  const ev = ctx.nationalEvent;
  const stats = await getStats(ev?.id ?? null);

  async function togglePublish() {
    "use server";
    await publishNationalEvent(ev!.id, !ev!.is_published);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
          {ctx.editionName} · NATIONAL TRACK FINAL
        </div>
        <h2 className="mt-1 text-2xl font-bold text-navy">{ev.name}</h2>
        {ev.tagline && (
          <p className="mt-1 text-sm text-navy/60">{ev.tagline}</p>
        )}
        <p className="mt-1 text-xs text-navy/50">
          {ev.start_date ?? "—"}
          {ev.venue && <span> · {ev.venue}</span>}
          <span className="ml-2">
            {ev.is_published ? (
              <span className="text-yi-green font-semibold">● PUBLISHED</span>
            ) : (
              <span className="text-navy/40 font-semibold">○ DRAFT</span>
            )}
          </span>
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Finalists", value: stats.finalists, href: "/yi-future/host/finalists" },
          { label: "Partners", value: stats.partners, href: "/yi-future/host/partners" },
          { label: "Internship slots", value: stats.slots, href: "/yi-future/host/internships" },
          { label: "Interviews", value: stats.interviews, href: "/yi-future/host/interviews" },
          { label: "Govt engagements", value: stats.government, href: "/yi-future/host/government" },
        ].map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="bg-white border border-navy/10 rounded-lg p-4 hover:border-yi-gold/50 hover:shadow-sm transition-all"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
              {m.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-navy">{m.value}</div>
          </Link>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <form action={togglePublish}>
          <button
            type="submit"
            className={`px-4 py-2 rounded-md text-sm font-semibold ${
              ev.is_published
                ? "bg-yi-green/10 text-yi-green hover:bg-yi-green/20"
                : "bg-navy text-ivory hover:bg-navy-dark"
            }`}
          >
            {ev.is_published ? "Unpublish" : "Publish"}
          </button>
        </form>
        <Link
          href={`/event/${ev.id}/display`}
          target="_blank"
          className="px-4 py-2 rounded-md text-sm font-semibold border border-navy/20 text-navy/70 hover:border-navy/40"
        >
          Projector view ↗
        </Link>
      </div>
    </div>
  );
}
