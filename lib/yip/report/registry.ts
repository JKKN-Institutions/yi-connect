/**
 * YIP Chapter Round Report — section registry.
 *
 * The single ordered list of report sections. The page shell
 * (app/yip/dashboard/events/[id]/report/page.tsx) imports SECTION_COMPONENTS
 * and renders each in order inside the printable container, wrapped in
 * <Suspense>. Adding a new section = drop a self-fetching server component at
 * app/yip/dashboard/events/[id]/report/_sections/<Pascal>.tsx and add it here.
 *
 * NOTE: this is a plain (non-"use server") module so it may export the const
 * arrays + types the page needs. Section data types are NOT re-exported here —
 * the page never imports a section's data shape (component contract).
 *
 * Each section component MUST default-export:
 *   async function <Pascal>Section(
 *     { eventId, canManage }: { eventId: string; canManage: boolean }
 *   )
 */
import type { ComponentType } from "react";

import ExecutiveSummarySection from "@/app/yip/dashboard/events/[id]/report/_sections/ExecutiveSummary";
import OverviewSection from "@/app/yip/dashboard/events/[id]/report/_sections/Overview";
import GuestsJurySection from "@/app/yip/dashboard/events/[id]/report/_sections/GuestsJury";
import DelegatesSection from "@/app/yip/dashboard/events/[id]/report/_sections/Delegates";
import PartiesGovernmentSection from "@/app/yip/dashboard/events/[id]/report/_sections/PartiesGovernment";
import CommitteesBillsSection from "@/app/yip/dashboard/events/[id]/report/_sections/CommitteesBills";
import AwardsZeroHourSection from "@/app/yip/dashboard/events/[id]/report/_sections/AwardsZeroHour";
import MediaSection from "@/app/yip/dashboard/events/[id]/report/_sections/Media";

export type ReportSectionProps = {
  eventId: string;
  canManage: boolean;
};

export type ReportSection = {
  /** Stable key (matches the kebab data-helper / action filename). */
  key: string;
  /** "Section N — Title" label printed above each block. */
  title: string;
  Component: ComponentType<ReportSectionProps>;
};

/**
 * Ordered list, Section 1 → 7, exactly as the official YIP Chapter Round Report
 * template lays out. The page renders these top-to-bottom.
 */
export const REPORT_SECTIONS: ReportSection[] = [
  {
    key: "executive-summary",
    title: "Executive Summary",
    Component: ExecutiveSummarySection,
  },
  { key: "overview", title: "Section 1 — Event Overview", Component: OverviewSection },
  { key: "guests-jury", title: "Section 2 — Chief Guests & Jury", Component: GuestsJurySection },
  { key: "delegates", title: "Section 3 — Delegates", Component: DelegatesSection },
  {
    key: "parties-government",
    title: "Section 4 — Parties & Government",
    Component: PartiesGovernmentSection,
  },
  {
    key: "committees-bills",
    title: "Section 5 — Committees & Bills",
    Component: CommitteesBillsSection,
  },
  {
    key: "awards-zero-hour",
    title: "Section 6 — Awards & Zero Hour",
    Component: AwardsZeroHourSection,
  },
  { key: "media", title: "Section 7 — Media & Coverage", Component: MediaSection },
];
