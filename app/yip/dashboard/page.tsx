import Link from "next/link";
import { createClient } from "@/lib/yip/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getRegionalAdminZones, getYipChapterScopes } from "@/lib/yi/auth/yi-directory-roles";
import { Plus, CalendarDays } from "lucide-react";
import { EventsGridClient, type EventCard } from "./events-grid-client";
import { OnboardingLauncher } from "@/components/yip/guide/onboarding-launcher";
import { GUIDES } from "@/lib/yip/guide/content";
import { getCompletedSteps, logGuideEvent } from "@/lib/yip/guide/actions";
import { SectionShell, INK, SAFFRON, SERIF, inkA } from "@/app/yip/me/credential-ui";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Event visibility (updated 2026-06-01 for the two-role-per-chapter model):
  //  - Super-admin (national)     → ALL events
  //  - Regional admin             → events in their assigned zone(s)
  //  - Chapter admin / organiser  → events for their chapter(s)
  //  - Plus everyone: events they created
  // created_by alone is NO LONGER the chapter-visibility signal — a chapter
  // chair/organiser must see their chapter's events even when national/SQL
  // created them. (Bug: chapter organisers saw an empty dashboard.)
  const isSuper = await isCurrentUserSuperAdmin();
  const regionalZones = isSuper ? [] : await getRegionalAdminZones("yip");
  const myChapters = isSuper ? [] : await getYipChapterScopes("yip");
  let eventsQuery = supabase.from("events").select("*");
  if (!isSuper) {
    // Postgrest "or": own events OR events in my zone(s) OR events in my chapter(s).
    const ors = [`created_by.eq.${user!.id}`];
    if (regionalZones.length > 0) {
      ors.push(`yi_zone_code.in.(${regionalZones.map((z) => `"${z}"`).join(",")})`);
    }
    if (myChapters.length > 0) {
      // Chapter chairs / organisers are scoped to CHAPTER-level events only.
      // Regional / national events (even if tagged with a chapter_name) belong
      // to RM (zone) / national roles, not the chapter chair. (2026-06-02)
      ors.push(
        `and(chapter_name.in.(${myChapters
          .map((c) => `"${c}"`)
          .join(",")}),level.eq.chapter)`
      );
    }
    eventsQuery = eventsQuery.or(ors.join(","));
  }
  const { data: events } = await eventsQuery.order("created_at", { ascending: false });

  // Fetch participant counts for each event
  const eventIds = (events ?? []).map((e) => e.id);
  let participantCounts: Record<string, number> = {};

  if (eventIds.length > 0) {
    // PostgREST caps a single response at ~1000 rows; a national/regional viewer
    // sees many events whose participants together exceed that, so a bare select
    // silently undercounts the per-event counts on the cards. Page through in
    // full batches.
    const counts = await fetchAllRows<{ event_id: string }>((from, to) =>
      supabase
        .from("participants")
        .select("event_id")
        .in("event_id", eventIds)
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: { event_id: string }[] | null;
        error: unknown;
      }>
    );

    participantCounts = counts.reduce(
      (acc, row) => {
        acc[row.event_id] = (acc[row.event_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  // Shape the role-scoped list for the client grid (search / filter / sort live
  // there). The server query above stays the authorization boundary.
  const eventsForClient: EventCard[] = (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    level: e.level,
    day1_date: e.day1_date,
    day2_date: e.day2_date,
    city: e.city,
    venue_name: e.venue_name,
    chapter_name: e.chapter_name,
    yi_zone_code: e.yi_zone_code,
    is_mock: e.is_mock,
    created_at: e.created_at,
    updated_at: e.updated_at,
    participantCount: participantCounts[e.id] || 0,
  }));

  const hasEvents = events && events.length > 0;

  // Onboarding entry for the organiser — always visible, label derived from
  // saved progress (Start / Resume · N left / Replay), never a first-login flag.
  const onboardingCompleted = await getCompletedSteps("organiser");

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            Organiser
          </p>
          <h1
            className="mt-0.5 font-[family-name:var(--font-heading)] text-2xl font-bold"
            style={{ color: INK }}
          >
            My Events
          </h1>
          <p className="text-sm" style={{ color: inkA(0.4) }}>
            Manage your Young Indians Parliament events
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OnboardingLauncher
            guide={GUIDES.organiser}
            persona="organiser"
            completed={onboardingCompleted}
            onEvent={logGuideEvent}
          />
          <Link href="/yip/dashboard/events/new">
            <button className="inline-flex items-center gap-2 rounded-xl bg-[#FF9933] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#FF9933]/20 transition-all hover:bg-[#E68A2E] hover:shadow-xl hover:shadow-[#FF9933]/25 min-h-[44px]">
              <Plus className="size-4" />
              Create New Event
            </button>
          </Link>
        </div>
      </div>

      {/* Events list */}
      {hasEvents ? (
        <EventsGridClient events={eventsForClient} />
      ) : (
        /* Empty state */
        <SectionShell accent={SAFFRON} className="shadow-sm">
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF9933]/10">
              <CalendarDays className="size-8 text-[#FF9933]" />
            </div>
            <h3
              className="mb-2 font-[family-name:var(--font-heading)] text-lg font-semibold"
              style={{ color: INK }}
            >
              No events yet
            </h3>
            <p className="mb-6 max-w-sm text-sm text-[#1a1a3e]/40">
              Create your first Young Indians Parliament event to get started.
              Set up the agenda, invite participants, and manage everything from
              here.
            </p>
            <Link href="/yip/dashboard/events/new">
              <button className="inline-flex items-center gap-2 rounded-xl bg-[#FF9933] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#FF9933]/20 transition-all hover:bg-[#E68A2E] hover:shadow-xl hover:shadow-[#FF9933]/25 min-h-[44px]">
                <Plus className="size-4" />
                Create your first YIP event
              </button>
            </Link>
          </div>
        </SectionShell>
      )}
    </div>
  );
}
