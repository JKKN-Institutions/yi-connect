"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/yip/utils";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import {
  MapPin,
  Users,
  Trophy,
  Building2,
  ChevronRight,
  ChevronDown,
  Search,
  Mail,
  ArrowUpRight,
  CircleSlash,
} from "lucide-react";
import type {
  CoverageReport,
  ChapterCoverage,
  CoverageStage,
} from "@/app/yip/actions/coverage";

const STAGE_META: Record<
  CoverageStage,
  { label: string; badge: string; dot: string }
> = {
  completed: {
    label: "Completed",
    badge: "bg-[#138808]/10 text-[#138808] border-[#138808]/20",
    dot: "bg-[#138808]",
  },
  live: {
    label: "Live",
    badge: "bg-[#FF9933]/10 text-[#E68A2E] border-[#FF9933]/25",
    dot: "bg-[#FF9933]",
  },
  registration: {
    label: "Registration",
    badge: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: "bg-indigo-500",
  },
  created: {
    label: "Draft",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  none: {
    label: "Not started",
    badge: "bg-[#1a1a3e]/5 text-[#1a1a3e]/50 border-[#1a1a3e]/10",
    dot: "bg-[#1a1a3e]/20",
  },
};

export function CoverageClient({ report }: { report: CoverageReport }) {
  const [query, setQuery] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();

  const filteredRegions = useMemo(() => {
    return report.regions
      .map((region) => {
        const chapters = region.chapters.filter((c) => {
          if (gapsOnly && c.event_count > 0) return false;
          if (!q) return true;
          return (
            c.name.toLowerCase().includes(q) ||
            (c.city ?? "").toLowerCase().includes(q) ||
            (c.state ?? "").toLowerCase().includes(q) ||
            (c.chair_name ?? "").toLowerCase().includes(q)
          );
        });
        return { ...region, chapters };
      })
      .filter((r) => r.chapters.length > 0);
  }, [report.regions, q, gapsOnly]);

  const { totals } = report;
  const pct =
    totals.total_chapters > 0
      ? Math.round((totals.with_event / totals.total_chapters) * 100)
      : 0;

  // Auto-expand regions when a filter is active so matches are visible.
  const filtering = q.length > 0 || gapsOnly;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight">
          National Coverage
        </h1>
        <p className="text-sm text-[#1a1a3e]/60 mt-1">
          Which of the {totals.total_chapters} Yi chapters have run a YIP · 6
          regions · 2026
        </p>
      </div>

      {/* National rollup */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <RollupCard
          icon={Building2}
          label="Chapters"
          value={totals.total_chapters}
          accent="indigo"
        />
        <RollupCard
          icon={Trophy}
          label="Have an event"
          value={totals.with_event}
          accent="orange"
        />
        <RollupCard
          icon={MapPin}
          label="Completed"
          value={totals.completed}
          accent="green"
        />
        <RollupCard
          icon={Users}
          label="Students"
          value={totals.participant_count}
          accent="blue"
        />
      </div>

      {/* Coverage bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#1a1a3e]">
              {totals.with_event} of {totals.total_chapters} chapters have
              started a YIP
            </span>
            <span className="font-semibold text-[#FF9933]">{pct}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-[#1a1a3e]/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#138808] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#1a1a3e]/50">
            {totals.total_chapters - totals.with_event} chapters have not started
            · {totals.completed} have published results
          </p>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapter, city, state, or chair…"
            className="w-full rounded-lg border border-[#1a1a3e]/10 bg-white pl-9 pr-3 py-2.5 text-sm text-[#1a1a3e] placeholder:text-[#1a1a3e]/40 focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933] min-h-[44px]"
          />
        </div>
        <button
          type="button"
          onClick={() => setGapsOnly((v) => !v)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
            gapsOnly
              ? "border-[#FF9933] bg-[#FF9933]/10 text-[#E68A2E]"
              : "border-[#1a1a3e]/10 bg-white text-[#1a1a3e]/70 hover:border-[#1a1a3e]/20"
          )}
        >
          <CircleSlash className="size-4" />
          Not started only
        </button>
      </div>

      {/* Regions */}
      <div className="space-y-3">
        {filteredRegions.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[#1a1a3e]/50">
              No chapters match.
            </CardContent>
          </Card>
        )}
        {filteredRegions.map((region) => {
          const expanded = filtering || open[region.code];
          const rPct =
            region.total_chapters > 0
              ? Math.round(
                  (region.with_event / region.total_chapters) * 100
                )
              : 0;
          return (
            <Card key={region.code} className="overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setOpen((o) => ({ ...o, [region.code]: !o[region.code] }))
                }
                className="w-full text-left"
                disabled={filtering}
              >
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#1a1a3e]/[0.015] transition-colors">
                  {filtering ? (
                    <ChevronDown className="size-4 text-[#1a1a3e]/30 shrink-0" />
                  ) : expanded ? (
                    <ChevronDown className="size-4 text-[#1a1a3e]/40 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 text-[#1a1a3e]/40 shrink-0" />
                  )}
                  <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/70 border border-[#1a1a3e]/10 font-mono text-[10px] shrink-0">
                    {region.code}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#1a1a3e] truncate">
                      {region.label}
                    </div>
                    <div className="text-xs text-[#1a1a3e]/55">
                      {region.with_event}/{region.total_chapters} started ·{" "}
                      {region.completed} completed · {region.participant_count}{" "}
                      students
                    </div>
                  </div>
                  <div className="hidden sm:block w-28 shrink-0">
                    <div className="h-1.5 w-full rounded-full bg-[#1a1a3e]/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF9933]"
                        style={{ width: `${rPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-[#1a1a3e]/5 divide-y divide-[#1a1a3e]/5">
                  {region.chapters.map((c) => (
                    <ChapterRow key={c.chapter_id} c={c} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ChapterRow({ c }: { c: ChapterCoverage }) {
  const meta = STAGE_META[c.stage];
  const place = [c.city, c.state].filter(Boolean).join(", ");

  const inner = (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-[#1a1a3e]/[0.015] transition-colors">
      <span className={cn("size-2 rounded-full shrink-0", meta.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#1a1a3e] truncate">{c.name}</span>
          <Badge className={cn("border text-[10px] shrink-0", meta.badge)}>
            {meta.label}
          </Badge>
        </div>
        <div className="text-xs text-[#1a1a3e]/55 truncate">
          {place || "—"}
          {c.chair_name ? ` · Chair: ${c.chair_name}` : ""}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-4 text-xs text-[#1a1a3e]/60 shrink-0">
        {c.event_count > 0 && (
          <span>
            {c.event_count} event{c.event_count === 1 ? "" : "s"}
          </span>
        )}
        {c.participant_count > 0 && (
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {c.participant_count}
          </span>
        )}
        {c.chair_email && (
          <a
            href={`mailto:${c.chair_email}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[#1a1a3e]/40 hover:text-[#FF9933]"
            title={c.chair_email}
          >
            <Mail className="size-3.5" />
          </a>
        )}
      </div>

      {c.latest_event_id ? (
        <ArrowUpRight className="size-4 text-[#1a1a3e]/30 shrink-0" />
      ) : (
        <span className="w-4 shrink-0" />
      )}
    </div>
  );

  if (c.latest_event_id) {
    return (
      <Link href={`/yip/dashboard/events/${c.latest_event_id}`} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function RollupCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "orange" | "blue" | "green" | "indigo";
}) {
  const map = {
    orange: { bg: "bg-[#FF9933]/10", text: "text-[#FF9933]" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    green: { bg: "bg-[#138808]/10", text: "text-[#138808]" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  }[accent];

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div
            className={`size-9 rounded-lg ${map.bg} flex items-center justify-center`}
          >
            <Icon className={`size-5 ${map.text}`} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1a1a3e]">{value}</div>
            <div className="text-xs text-[#1a1a3e]/60">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
