import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";

type EventRow = { id: string };
type AdvancementRow = { id: string };
type PartnerRow = { id: string };
type InternshipSlotRow = { slots_available: number | null; partner_id: string };
type InterviewRow = { id: string };
type GovRow = { id: string };

async function getMetrics(chapterId: string, editionId: string) {
  const svc = await createServiceClient();

  // 1. Find host's national_track_final event(s) for this edition
  const { data: eventsData } = await svc
    .schema("future")
    .from("events")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("type", "national_track_final");
  const events = (eventsData as unknown as EventRow[]) ?? [];
  const eventIds = events.map((e) => e.id);

  if (eventIds.length === 0) {
    return {
      hasEvent: false,
      teamsAdvanced: 0,
      partners: 0,
      internshipSlots: 0,
      interviews: 0,
      government: 0,
    };
  }

  // 2. Teams advanced into any of these events
  const { data: advData } = await svc
    .schema("future")
    .from("advancements")
    .select("id")
    .in("to_event_id", eventIds);
  const teamsAdvanced = ((advData as unknown as AdvancementRow[]) ?? []).length;

  // 3. Partners for these events
  const { data: partnersData } = await svc
    .schema("future")
    .from("corporate_partners")
    .select("id")
    .in("event_id", eventIds);
  const partners = ((partnersData as unknown as PartnerRow[]) ?? []).length;
  const partnerIds = ((partnersData as unknown as { id: string }[]) ?? []).map(
    (p) => p.id
  );

  // 4. Internship slots: sum slots_available from slots linked to those partners
  let internshipSlots = 0;
  if (partnerIds.length > 0) {
    const { data: slotsData } = await svc
      .schema("future")
      .from("internship_slots")
      .select("slots_available, partner_id")
      .in("partner_id", partnerIds);
    const slots = (slotsData as unknown as InternshipSlotRow[]) ?? [];
    internshipSlots = slots.reduce(
      (sum, s) => sum + (s.slots_available ?? 0),
      0
    );
  }

  // 5. Scheduled interviews
  const { data: interviewsData } = await svc
    .schema("future")
    .from("interview_slots")
    .select("id")
    .in("event_id", eventIds);
  const interviews = ((interviewsData as unknown as InterviewRow[]) ?? [])
    .length;

  // 6. Government engagements
  const { data: govData } = await svc
    .schema("future")
    .from("government_engagements")
    .select("id")
    .in("event_id", eventIds);
  const government = ((govData as unknown as GovRow[]) ?? []).length;

  return {
    hasEvent: true,
    teamsAdvanced,
    partners,
    internshipSlots,
    interviews,
    government,
  };
}

export default async function HostMetricsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/login");

  const m = await getMetrics(ctx.chapterId, ctx.editionId);

  const tiles = [
    {
      label: "Teams advanced",
      value: m.teamsAdvanced,
      hint: "Finalists from chapter finals",
    },
    {
      label: "Partners",
      value: m.partners,
      hint: "Corporate partners engaged",
    },
    {
      label: "Internship slots",
      value: m.internshipSlots,
      hint: "Total open seats offered",
    },
    {
      label: "Scheduled interviews",
      value: m.interviews,
      hint: "Delegate × partner bookings",
    },
    {
      label: "Government",
      value: m.government,
      hint: "Engagements & whitepaper reads",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Metrics</h2>
        <p className="mt-1 text-sm text-navy/60">
          Participation & outcomes for the National Track Final hosted by{" "}
          {ctx.chapterName}.
        </p>
      </div>

      {!m.hasEvent ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-navy/60 text-sm">
            No National Track Final event created yet for {ctx.editionName}.
          </div>
          <Link
            href="/yi-future/host"
            className="mt-3 inline-block text-xs font-semibold text-yi-gold hover:text-navy"
          >
            Go to Host overview →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
                {t.label}
              </div>
              <div className="mt-2 text-3xl font-bold text-navy">{t.value}</div>
              <div className="mt-1 text-[11px] text-navy/40">{t.hint}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
