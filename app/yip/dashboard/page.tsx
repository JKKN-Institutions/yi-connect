import Link from "next/link";
import { createClient } from "@/lib/yip/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getRegionalAdminZones, getYipChapterScopes } from "@/lib/yi/auth/yi-directory-roles";
import { Badge } from "@/components/yip/ui/badge";
import { Plus, CalendarDays, Users, MapPin } from "lucide-react";

// Status badge color mapping with premium styling
function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10",
    },
    registration_open: {
      label: "Registration Open",
      className: "bg-[#FF9933]/8 text-[#FF9933] border border-[#FF9933]/15",
    },
    registration_closed: {
      label: "Registration Closed",
      className: "bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/15",
    },
    day1_live: {
      label: "Day 1 Live",
      className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15",
    },
    day1_complete: {
      label: "Day 1 Complete",
      className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15",
    },
    day2_live: {
      label: "Day 2 Live",
      className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15",
    },
    completed: {
      label: "Completed",
      className: "bg-[#1a1a3e]/5 text-[#1a1a3e] border border-[#1a1a3e]/10",
    },
    results_published: {
      label: "Results Published",
      className: "bg-[#FF9933]/8 text-[#FF9933] border border-[#FF9933]/15",
    },
  };
  return map[status] ?? { label: status, className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" };
}

function levelBadge(level: string) {
  const map: Record<string, { label: string; className: string }> = {
    chapter: {
      label: "Chapter",
      className: "bg-[#FF9933]/8 text-[#FF9933] border border-[#FF9933]/15",
    },
    regional: {
      label: "Regional",
      className: "bg-[#1a1a3e]/5 text-[#1a1a3e] border border-[#1a1a3e]/10",
    },
    national: {
      label: "National",
      className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15",
    },
  };
  return map[level] ?? { label: level, className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
    const { data: counts } = await supabase
      .from("participants")
      .select("event_id")
      .in("event_id", eventIds);

    if (counts) {
      participantCounts = counts.reduce(
        (acc, row) => {
          acc[row.event_id] = (acc[row.event_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  const hasEvents = events && events.length > 0;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">My Events</h1>
          <p className="text-sm text-[#1a1a3e]/40">
            Manage your Young Indians Parliament events
          </p>
        </div>
        <Link href="/yip/dashboard/events/new">
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#FF9933] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#FF9933]/20 transition-all hover:bg-[#E68A2E] hover:shadow-xl hover:shadow-[#FF9933]/25 min-h-[44px]">
            <Plus className="size-4" />
            Create New Event
          </button>
        </Link>
      </div>

      {/* Events list */}
      {hasEvents ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const status = statusBadge(event.status);
            const level = levelBadge(event.level);
            const count = participantCounts[event.id] || 0;

            return (
              <Link key={event.id} href={`/yip/dashboard/events/${event.id}`}>
                <div className="cursor-pointer overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm transition-all hover:border-[#1a1a3e]/10 hover:shadow-md">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold leading-snug text-[#1a1a3e]">
                        {event.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <Badge
                        variant="secondary"
                        className={level.className}
                      >
                        {level.label}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={status.className}
                      >
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="border-t border-[#1a1a3e]/5 px-5 pb-5 pt-4">
                    <div className="space-y-2 text-sm text-[#1a1a3e]/60">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-[#1a1a3e]/30" />
                        <span>
                          {formatDate(event.day1_date)} &ndash;{" "}
                          {formatDate(event.day2_date)}
                        </span>
                      </div>
                      {(event.city || event.venue_name) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 text-[#1a1a3e]/30" />
                          <span>
                            {[event.venue_name, event.city]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-[#1a1a3e]/30" />
                        <span>
                          {count} participant{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white py-16 shadow-sm">
          <div className="flex flex-col items-center px-5 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF9933]/10">
              <CalendarDays className="size-8 text-[#FF9933]" />
            </div>
            <h3 className="mb-2 font-[family-name:var(--font-heading)] text-lg font-semibold text-[#1a1a3e]">
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
        </div>
      )}
    </div>
  );
}
