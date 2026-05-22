import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";

type Partner = {
  id: string;
  organization: string;
  event_id: string;
  events: {
    name: string;
    chapter_id: string | null;
    chapters: { name: string; city: string } | null;
  } | null;
  internship_slots: {
    id: string;
    title: string;
    slots_available: number | null;
    is_active: boolean | null;
  }[];
  interview_slots: {
    id: string;
    scheduled_at: string;
    outcome: string | null;
  }[];
};

async function getPartnerView(partnerId: string): Promise<Partner | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("corporate_partners")
    .select(
      "id, organization, event_id, events(name, chapter_id, chapters(name, city)), internship_slots(id, title, slots_available, is_active), interview_slots(id, scheduled_at, outcome)"
    )
    .eq("id", partnerId)
    .maybeSingle();
  return (data as unknown as Partner) ?? null;
}

export default async function PartnerHome() {
  const session = await readSession();
  if (!session || session.type !== "partner") redirect("/yi-future/join");

  const p = await getPartnerView(session.id);
  if (!p) redirect("/yi-future/join");

  const activeSlots = p.internship_slots.filter((s) => s.is_active).length;
  const totalSlotsAvail = p.internship_slots.reduce(
    (s, r) => s + (r.slots_available ?? 0),
    0
  );
  const now = new Date();
  const upcoming = p.interview_slots.filter(
    (iv) => new Date(iv.scheduled_at) >= now
  ).length;
  const completed = p.interview_slots.filter(
    (iv) => new Date(iv.scheduled_at) < now
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{p.organization}</h1>
        <p className="mt-1 text-sm text-navy/60">
          {p.events?.chapters?.name}
          {p.events?.chapters?.city && ` · ${p.events.chapters.city}`}
          {" · "}
          {p.events?.name}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/yi-future/partner/resumes"
          className="bg-white border border-navy/10 rounded-lg p-4 hover:border-yi-gold/50 transition-all"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Finalist resumes
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">View →</div>
        </Link>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Your slots
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">
            {activeSlots}
          </div>
          <div className="text-[10px] text-navy/50 mt-0.5">
            {totalSlotsAvail} openings
          </div>
        </div>
        <Link
          href="/yi-future/partner/interviews"
          className="bg-white border border-navy/10 rounded-lg p-4 hover:border-yi-gold/50 transition-all"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Upcoming interviews
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">{upcoming}</div>
        </Link>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Completed
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">{completed}</div>
        </div>
      </div>

      {/* Your slots */}
      {p.internship_slots.length > 0 && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-bold text-navy mb-3">
            Your internship slots
          </h3>
          <ul className="space-y-2">
            {p.internship_slots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between p-2 border border-navy/10 rounded text-sm"
              >
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-xs text-navy/50">
                    {s.slots_available ?? 0} slot(s) ·{" "}
                    {s.is_active ? (
                      <span className="text-yi-green">active</span>
                    ) : (
                      <span className="text-navy/40">paused</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-navy/50">
            To add or edit slots, ask your host chapter admin.
          </p>
        </section>
      )}
    </div>
  );
}
