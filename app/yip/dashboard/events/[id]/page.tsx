import Link from "next/link";
import { getEvent } from "@/app/yip/actions/events";
import { getChiefGuests } from "@/app/yip/actions/reporting-extras";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { EventReportingCard } from "./event-reporting-card";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { Badge } from "@/components/yip/ui/badge";
import {
  CalendarDays,
  MapPin,
  Users,
  Scale,
  UserPlus,
  Shuffle,
  Radio,
  Upload,
  Pencil,
} from "lucide-react";

// Status badge mapping with premium styling
function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" },
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
  return (
    map[status] ?? { label: status, className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" }
  );
}

function levelLabel(level: string) {
  const map: Record<string, string> = {
    chapter: "Chapter Level",
    regional: "Regional Level",
    national: "National Level",
  };
  return map[level] ?? level;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event. It may have been deleted, or you may not be the organizer, regional admin, or super-admin for it." />
    );
  }

  const status = statusBadge(event.status);
  const access = await getYipEventAccess(id);
  const chiefGuests = await getChiefGuests(id);

  // Determine action cards based on status
  const actionCards: Array<{
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
    iconBg: string;
  }> = [];

  if (event.status === "draft") {
    actionCards.push({
      title: "Add Participants",
      description:
        "Add students individually or import from CSV to get started",
      href: `/yip/dashboard/events/${id}/participants`,
      icon: UserPlus,
      iconBg: "bg-[#FF9933]/10 text-[#FF9933]",
    });
    actionCards.push({
      title: "Run Allocation",
      description:
        "Assign parties, roles, and ministries to all participants",
      href: `/yip/dashboard/events/${id}/allocation`,
      icon: Shuffle,
      iconBg: "bg-[#1a1a3e]/5 text-[#1a1a3e]",
    });
  }

  if (event.status === "registration_open") {
    actionCards.push({
      title: "Import Students",
      description: "Bulk import students from a CSV file",
      href: `/yip/dashboard/events/${id}/participants`,
      icon: Upload,
      iconBg: "bg-[#FF9933]/10 text-[#FF9933]",
    });
  }

  if (
    event.status === "registration_closed" ||
    (event.allocation_locked && !event.status.includes("live"))
  ) {
    actionCards.push({
      title: "Go Live",
      description: "Start Day 1 of the parliament session",
      href: `/yip/dashboard/events/${id}/control`,
      icon: Radio,
      iconBg: "bg-[#138808]/10 text-[#138808]",
    });
  }

  if (event.status === "day1_live" || event.status === "day2_live") {
    actionCards.push({
      title: "Open Control Panel",
      description: "Manage the live session agenda and timers",
      href: `/yip/dashboard/events/${id}/control`,
      icon: Radio,
      iconBg: "bg-[#138808]/10 text-[#138808]",
    });
  }

  return (
    <div className="space-y-6">
      {/* Event Details Card */}
      <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
        <div className="flex items-start justify-between p-5 pb-0 sm:p-6 sm:pb-0">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#1a1a3e]">
            Event Details
          </h2>
          <div className="flex items-center gap-2">
            <Link href={`/yip/dashboard/events/${id}/edit`}>
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a1a3e]/5 px-3 py-1.5 text-xs font-medium text-[#1a1a3e]/60 transition-colors hover:border-[#1a1a3e]/10 hover:text-[#1a1a3e]">
                <Pencil className="size-3" />
                Edit
              </button>
            </Link>
            <Badge variant="secondary" className={status.className}>
              {status.label}
            </Badge>
          </div>
        </div>
        <div className="p-5 pt-4 sm:p-6 sm:pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-[#1a1a3e]/30" />
                <span className="text-[#1a1a3e]/40">Level:</span>
                <span className="font-medium text-[#1a1a3e]">{levelLabel(event.level)}</span>
              </div>
              {event.chapter_name && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="size-4 text-[#1a1a3e]/30" />
                  <span className="text-[#1a1a3e]/40">Chapter:</span>
                  <span className="font-medium text-[#1a1a3e]">{event.chapter_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-[#1a1a3e]/30" />
                <span className="text-[#1a1a3e]/40">Day 1:</span>
                <span className="font-medium text-[#1a1a3e]">
                  {formatDate(event.day1_date)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-[#1a1a3e]/30" />
                <span className="text-[#1a1a3e]/40">Day 2:</span>
                <span className="font-medium text-[#1a1a3e]">
                  {formatDate(event.day2_date)}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {(event.venue_name || event.venue_address) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 text-[#1a1a3e]/30" />
                  <div>
                    {event.venue_name && (
                      <p className="font-medium text-[#1a1a3e]">{event.venue_name}</p>
                    )}
                    {event.venue_address && (
                      <p className="text-[#1a1a3e]/40">{event.venue_address}</p>
                    )}
                  </div>
                </div>
              )}
              {(event.city || event.state) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-[#1a1a3e]/30" />
                  <span className="font-medium text-[#1a1a3e]">
                    {[event.city, event.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF9933]/10">
              <Users className="size-6 text-[#FF9933]" />
            </div>
            <div>
              <p className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">{event.participantCount}</p>
              <p className="text-xs text-[#1a1a3e]/40">Total Participants</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#138808]/10">
              <Scale className="size-6 text-[#138808]" />
            </div>
            <div>
              <p className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">{event.juryCount}</p>
              <p className="text-xs text-[#1a1a3e]/40">Jury Members</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1a3e]/5">
              <Shuffle className="size-6 text-[#1a1a3e]" />
            </div>
            <div>
              <p className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
                {event.allocation_locked ? "Locked" : "Pending"}
              </p>
              <p className="text-xs text-[#1a1a3e]/40">Allocation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      {actionCards.length > 0 && (
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#1a1a3e]">
            Next Steps
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {actionCards.map((card) => (
              <Link key={card.title} href={card.href}>
                <div className="group cursor-pointer overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm transition-all hover:border-[#1a1a3e]/10 hover:shadow-md">
                  <div className="flex items-start gap-4 border-l-[3px] border-l-[#FF9933] p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                      <card.icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-[family-name:var(--font-heading)] font-semibold text-[#1a1a3e]">{card.title}</h3>
                      <p className="mt-1 text-sm text-[#1a1a3e]/40">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reporting extras — chief guests (#11) + social coverage (#12) */}
      <div>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#1a1a3e]">
          Event Reporting
        </h2>
        <EventReportingCard
          eventId={id}
          canManage={access.canManage}
          initialChiefGuests={chiefGuests}
          initialSocialLinks={event.social_links ?? []}
          initialReach={event.social_reach_count ?? null}
        />
      </div>
    </div>
  );
}
