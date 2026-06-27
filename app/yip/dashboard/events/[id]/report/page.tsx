/**
 * YIP Chapter Round Report — printable page shell.
 *
 * End-of-Day-2 page that auto-assembles the official 8-section Chapter Round
 * Report from live event data. Each section is a self-fetching server component
 * (registered in lib/yip/report/registry.ts) wrapped in <Suspense> so the page
 * streams. When canManage, sections render inline fill-ins for the few gaps;
 * the organiser then prints to PDF.
 *
 * Gate: EVENT-SCOPED. canView is required to open the page (else Forbidden403).
 * canManage is passed down so each section can show its inline capture controls.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { REPORT_SECTIONS } from "@/lib/yip/report/registry";
import { PrintButton } from "./PrintButton";
import { ParticipantCardsControlSection } from "./_sections/ParticipantCardsControlSection";
import "./report-print.css";

export const metadata: Metadata = {
  title: "Chapter Round Report — YIP 2026",
};

/**
 * Show the YIP / partner branding band at the top of the printed report.
 * Single source of truth, matching the official template header.
 */
const SHOW_PARTNER_LOGOS = true;

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/3 animate-pulse rounded bg-[#1a1a3e]/8" />
      <div className="h-3 w-full animate-pulse rounded bg-[#1a1a3e]/5" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-[#1a1a3e]/5" />
    </div>
  );
}

/** Branded report header — partner band + title block. */
async function ReportHeader({ eventId }: { eventId: string }) {
  const svc = await createServiceClient();
  const { data: event } = await svc
    .from("events")
    .select("name, chapter_name, city, state, day1_date, day2_date, level")
    .eq("id", eventId)
    .maybeSingle();

  const fmt = (d: string | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const d1 = fmt(event?.day1_date);
  const d2 = fmt(event?.day2_date);
  const dateRange = d1 && d2 ? `${d1} – ${d2}` : d1 || d2 || "";
  const location = [event?.city, event?.state].filter(Boolean).join(", ");

  return (
    <header className="mb-8 border-b border-[#1a1a3e]/10 pb-6">
      {SHOW_PARTNER_LOGOS && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/45">
          <span>Young Indians</span>
          <span className="text-[#FF9933]">•</span>
          <span>One Bharat | Spirit</span>
          <span className="text-[#FF9933]">•</span>
          <span>CII</span>
          <span className="text-[#FF9933]">•</span>
          <span>Thalir</span>
        </div>
      )}
      <p className="text-center text-[13px] font-bold uppercase tracking-[0.2em] text-[#FF9933]">
        Young Indians Parliament 2026
      </p>
      <h1 className="mt-1 text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
        Chapter Round Report
      </h1>
      {event?.name && (
        <p className="mt-1 text-center text-base font-medium text-[#1a1a3e]/80">
          {event.name}
        </p>
      )}
      <p className="mt-1 text-center text-sm text-[#1a1a3e]/55">
        {[event?.chapter_name, location, dateRange].filter(Boolean).join(" · ")}
      </p>
    </header>
  );
}

export default async function ChapterRoundReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getYipEventAccess(id);

  if (!access.canView) {
    return (
      <Forbidden403 reason="You don't have access to this event's report. Ask the chapter chair or a YIP admin for access." />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Toolbar (hidden in print) */}
      <div className="print:hidden mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a3e]">
            Chapter Round Report
          </h2>
          <p className="text-sm text-[#1a1a3e]/55">
            Auto-assembled from this event. Fill any gaps inline, then print to
            PDF.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Chair control: enable + prepare the Day-2 participant AI recap cards.
          Self-gates on canManage; hidden from the printout. */}
      <div className="print:hidden mb-4">
        <ParticipantCardsControlSection eventId={id} canManage={access.canManage} />
      </div>

      {/* Printable report container */}
      <div
        id="yip-report"
        data-print-root
        className="rounded-xl border border-[#1a1a3e]/8 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <Suspense fallback={<SectionSkeleton />}>
          <ReportHeader eventId={id} />
        </Suspense>

        <div className="space-y-10">
          {REPORT_SECTIONS.map(({ key, title, Component }) => (
            <section key={key} className="yip-report-section break-inside-avoid">
              <h2 className="mb-4 border-b border-[#FF9933]/30 pb-1.5 font-[family-name:var(--font-heading)] text-lg font-semibold text-[#1a1a3e]">
                {title}
              </h2>
              <Suspense fallback={<SectionSkeleton />}>
                <Component eventId={id} canManage={access.canManage} />
              </Suspense>
            </section>
          ))}
        </div>

        {/* Footer line on the printout */}
        <footer className="mt-10 border-t border-[#1a1a3e]/10 pt-4 text-center text-[11px] text-[#1a1a3e]/40">
          Generated from Yi Connect · Young Indians Parliament 2026
        </footer>
      </div>
    </div>
  );
}
