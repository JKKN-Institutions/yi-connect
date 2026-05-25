import Link from "next/link";
import { createClient } from "@/lib/yi-future/supabase/server";
import { redirect } from "next/navigation";
import {
  NATIONAL_DAY1_SECTIONS,
  NATIONAL_DAY1_SECTION_LABELS,
  NATIONAL_DAY2_SECTIONS,
  NATIONAL_DAY2_SECTION_LABELS,
} from "@/lib/yi-future/constants";

// ─── Types ──────────────────────────────────────────────────────────

type SectionStatus = "upcoming" | "in_progress" | "completed";

type ScheduleSection = {
  key: string;
  label: string;
  day: 1 | 2;
  status: SectionStatus;
  startTime: string;
  endTime: string;
  venue: string;
};

// ─── Default schedule data (editable in-page) ───────────────────────

const DEFAULT_DAY1_TIMES: Record<string, { start: string; end: string; venue: string }> = {
  opening: { start: "09:00", end: "09:45", venue: "Main Hall" },
  keynote: { start: "10:00", end: "11:00", venue: "Main Hall" },
  masterclass: { start: "11:30", end: "13:00", venue: "Breakout Rooms A-D" },
  townhall: { start: "14:00", end: "15:30", venue: "Main Hall" },
  networking: { start: "16:00", end: "18:00", venue: "Exhibition Area" },
};

const DEFAULT_DAY2_TIMES: Record<string, { start: string; end: string; venue: string }> = {
  semi_final: { start: "09:00", end: "12:00", venue: "Track Rooms A-D" },
  grand_final: { start: "13:00", end: "15:30", venue: "Main Hall" },
  opportunity_interviews: { start: "13:00", end: "16:00", venue: "Interview Suites" },
  recognition: { start: "16:30", end: "18:00", venue: "Main Hall" },
};

// ─── Helpers ────────────────────────────────────────────────────────

function statusBadge(status: SectionStatus) {
  switch (status) {
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yi-gold bg-yi-gold/10 px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-yi-gold animate-pulse" />
          In Progress
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yi-green bg-yi-green/10 px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-yi-green" />
          Completed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy/40 bg-navy/5 px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-navy/20" />
          Upcoming
        </span>
      );
  }
}

// ─── Page ───────────────────────────────────────────────────────────

export default async function FinalsSchedulePage() {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  // Build schedule from constants + defaults
  const day1Sections: ScheduleSection[] = NATIONAL_DAY1_SECTIONS.map((key) => {
    const times = DEFAULT_DAY1_TIMES[key] ?? { start: "TBD", end: "TBD", venue: "TBD" };
    return {
      key,
      label: NATIONAL_DAY1_SECTION_LABELS[key],
      day: 1,
      status: "upcoming" as SectionStatus,
      startTime: times.start,
      endTime: times.end,
      venue: times.venue,
    };
  });

  const day2Sections: ScheduleSection[] = NATIONAL_DAY2_SECTIONS.map((key) => {
    const times = DEFAULT_DAY2_TIMES[key] ?? { start: "TBD", end: "TBD", venue: "TBD" };
    return {
      key,
      label: NATIONAL_DAY2_SECTION_LABELS[key],
      day: 2,
      status: "upcoming" as SectionStatus,
      startTime: times.start,
      endTime: times.end,
      venue: times.venue,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">National Finals Schedule</h2>
          <p className="mt-1 text-sm text-navy/60">
            Two-day agenda for the National Finals event
          </p>
        </div>
        <Link
          href="/yi-future/national/admin"
          className="text-xs font-semibold text-navy hover:text-yi-gold"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* Day 1 */}
      <DayCard day={1} label="Day 1 — Inspire & Connect" sections={day1Sections} />

      {/* Day 2 */}
      <DayCard day={2} label="Day 2 — Compete & Celebrate" sections={day2Sections} />
    </div>
  );
}

// ─── Day Card ───────────────────────────────────────────────────────

function DayCard({
  day,
  label,
  sections,
}: {
  day: number;
  label: string;
  sections: ScheduleSection[];
}) {
  const completedCount = sections.filter((s) => s.status === "completed").length;
  const inProgressCount = sections.filter((s) => s.status === "in_progress").length;

  return (
    <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
      {/* Day header */}
      <div className="bg-navy/[0.03] px-5 py-4 border-b border-navy/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-navy">{label}</h3>
            <p className="text-xs text-navy/50 mt-0.5">
              {sections.length} session{sections.length !== 1 ? "s" : ""}
              {completedCount > 0 && (
                <span className="text-yi-green ml-2">
                  {completedCount} completed
                </span>
              )}
              {inProgressCount > 0 && (
                <span className="text-yi-gold ml-2">
                  {inProgressCount} in progress
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-navy/40 bg-navy/5 px-2.5 py-1 rounded-full">
              Day {day}
            </span>
          </div>
        </div>
      </div>

      {/* Section rows */}
      <div className="divide-y divide-navy/5">
        {sections.map((section, idx) => (
          <div
            key={section.key}
            className="px-5 py-4 hover:bg-navy/[0.01] transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Time column */}
              <div className="flex-shrink-0 w-[120px]">
                <div className="font-mono text-sm font-bold text-navy">
                  {section.startTime}
                </div>
                <div className="font-mono text-xs text-navy/40">
                  to {section.endTime}
                </div>
              </div>

              {/* Content column */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-navy/5 text-[11px] font-bold text-navy/40">
                    {idx + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-navy">
                    {section.label}
                  </h4>
                </div>
                <div className="mt-1.5 ml-9 flex items-center gap-3 text-xs text-navy/50">
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {section.venue}
                  </span>
                </div>
              </div>

              {/* Status column */}
              <div className="flex-shrink-0">{statusBadge(section.status)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
