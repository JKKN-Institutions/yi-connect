import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent, getEventSetupProgress } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { EventTabNav } from "./event-tab-nav";
import { EventSectionSubTabs } from "./event-section-subtabs";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/yip/login");
  }

  // 3-tier visibility (super-admin / regional-admin / creator) — share the
  // single source of truth in getEvent so layout and page stay consistent.
  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event. It may have been deleted, or you may not be the organizer, regional admin, or super-admin for it." />
    );
  }

  // Scoring / Committees / Results tabs are national/super-admin-only
  // (2026-06-13) — hide them for chapter / regional roles.
  const access = await getYipEventAccess(id);

  // Setup-completion map for the sidebar checklist (Before-the-Event tabs).
  const setupProgress = await getEventSetupProgress(id);

  return (
    <div>
      {/* Event Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
      </div>

      {/* Vertical sidebar nav (desktop) + dropdown (mobile), beside the content */}
      <div className="lg:flex lg:gap-6">
        <EventTabNav
          eventId={id}
          eventStatus={event.status}
          canViewScores={access.canViewScores}
          setupProgress={setupProgress}
        />

        {/* Tab Content */}
        <div className="min-w-0 flex-1">
          {/* Sub-tab strip for merged sections (Participants/Registrations,
              Volunteers/YUVA, Scoring/Committee Scores, Proceedings). Renders
              only on those routes. */}
          <EventSectionSubTabs eventId={id} canViewScores={access.canViewScores} />
          {children}
        </div>
      </div>
    </div>
  );
}
