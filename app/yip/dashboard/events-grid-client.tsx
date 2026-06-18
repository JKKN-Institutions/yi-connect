"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/yip/ui/badge";
import { Input } from "@/components/yip/ui/input";
import { YI_ZONES } from "@/lib/yip/hierarchy";
import { CalendarDays, Users, MapPin, Search, X } from "lucide-react";

export type EventCard = {
  id: string;
  name: string;
  status: string;
  level: string;
  day1_date: string;
  day2_date: string;
  city: string | null;
  venue_name: string | null;
  chapter_name: string | null;
  yi_zone_code: string | null;
  is_mock: boolean;
  created_at: string | null;
  updated_at: string | null;
  participantCount: number;
};

// ── Badge + date helpers (moved from page.tsx so the grid renders client-side) ──
function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" },
    registration_open: { label: "Registration Open", className: "bg-[#FF9933]/8 text-[#FF9933] border border-[#FF9933]/15" },
    registration_closed: { label: "Registration Closed", className: "bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/15" },
    day1_live: { label: "Day 1 Live", className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15" },
    day1_complete: { label: "Day 1 Complete", className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15" },
    day2_live: { label: "Day 2 Live", className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15" },
    completed: { label: "Completed", className: "bg-[#1a1a3e]/5 text-[#1a1a3e] border border-[#1a1a3e]/10" },
    results_published: { label: "Results Published", className: "bg-[#FF9933]/8 text-[#FF9933] border border-[#FF9933]/15" },
  };
  return map[status] ?? { label: status, className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" };
}

function levelBadge(level: string) {
  const map: Record<string, { label: string; className: string }> = {
    chapter: { label: "Chapter", className: "bg-[#FF9933]/8 text-[#FF9933] border border-[#FF9933]/15" },
    regional: { label: "Regional", className: "bg-[#1a1a3e]/5 text-[#1a1a3e] border border-[#1a1a3e]/10" },
    national: { label: "National", className: "bg-[#138808]/8 text-[#138808] border border-[#138808]/15" },
  };
  return map[level] ?? { label: level, className: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border border-[#1a1a3e]/10" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const SORTS = [
  { value: "created", label: "Recently created" },
  { value: "name", label: "Name (A–Z)" },
  { value: "date", label: "Event date" },
  { value: "updated", label: "Recently updated" },
  { value: "chapter", label: "Chapter" },
] as const;

function EventCardView({ event }: { event: EventCard }) {
  const status = statusBadge(event.status);
  const level = levelBadge(event.level);
  const count = event.participantCount;
  return (
    <Link href={`/yip/dashboard/events/${event.id}`}>
      <div className="cursor-pointer overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm transition-all hover:border-[#1a1a3e]/10 hover:shadow-md">
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold leading-snug text-[#1a1a3e]">
              {event.name}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Badge variant="secondary" className={level.className}>{level.label}</Badge>
            <Badge variant="secondary" className={status.className}>{status.label}</Badge>
          </div>
        </div>
        <div className="border-t border-[#1a1a3e]/5 px-5 pb-5 pt-4">
          <div className="space-y-2 text-sm text-[#1a1a3e]/60">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[#1a1a3e]/30" />
              <span>{formatDate(event.day1_date)} &ndash; {formatDate(event.day2_date)}</span>
            </div>
            {(event.city || event.venue_name) && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[#1a1a3e]/30" />
                <span>{[event.venue_name, event.city].filter(Boolean).join(", ")}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#1a1a3e]/30" />
              <span>{count} participant{count !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function EventsGridClient({ events }: { events: EventCard[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Toolbar only earns its keep once there's a real list to sift. A chapter
  // chair sees 1–2 events → render plain cards, no chrome.
  const showToolbar = events.length > 5;

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [zone, setZone] = useState(() => searchParams.get("zone") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "created");
  const [showMock, setShowMock] = useState(() => searchParams.get("mock") === "1");

  // Sync state → URL (debounced) so a filtered view is shareable + refresh-safe.
  useEffect(() => {
    if (!showToolbar) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (zone) params.set("zone", zone);
    if (status) params.set("status", status);
    if (sort && sort !== "created") params.set("sort", sort);
    if (showMock) params.set("mock", "1");
    const qs = params.toString();
    const t = setTimeout(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [q, zone, status, sort, showMock, showToolbar, pathname, router]);

  const base = useMemo(
    () => (showMock ? events : events.filter((e) => !e.is_mock)),
    [events, showMock]
  );

  const zoneCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of base) if (e.yi_zone_code) m[e.yi_zone_code] = (m[e.yi_zone_code] || 0) + 1;
    return m;
  }, [base]);

  const statusOptions = useMemo(
    () => Array.from(new Set(base.map((e) => e.status))).sort(),
    [base]
  );

  const filtered = useMemo(() => {
    let list = base;
    if (zone) list = list.filter((e) => e.yi_zone_code === zone);
    if (status) list = list.filter((e) => e.status === status);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (e) =>
          (e.name ?? "").toLowerCase().includes(needle) ||
          (e.chapter_name ?? "").toLowerCase().includes(needle) ||
          (e.city ?? "").toLowerCase().includes(needle)
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        break;
      case "date":
        sorted.sort((a, b) => (a.day1_date ?? "").localeCompare(b.day1_date ?? ""));
        break;
      case "updated":
        sorted.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
        break;
      case "chapter":
        sorted.sort((a, b) => (a.chapter_name ?? "").localeCompare(b.chapter_name ?? ""));
        break;
      default:
        sorted.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    return sorted;
  }, [base, zone, status, q, sort]);

  // No toolbar (small scoped list) → just the cards.
  if (!showToolbar) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((e) => (
          <EventCardView key={e.id} event={e} />
        ))}
      </div>
    );
  }

  const hasActiveFilters = !!(q.trim() || zone || status || showMock);
  function clearAll() {
    setQ("");
    setZone("");
    setStatus("");
    setSort("created");
    setShowMock(false);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 space-y-3 rounded-xl border border-[#1a1a3e]/5 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#1a1a3e]/30" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by event, chapter or city…"
              aria-label="Search events"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-lg border border-[#1a1a3e]/10 bg-white px-2.5 text-sm text-[#1a1a3e]"
            >
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{statusBadge(s).label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort events"
              className="h-9 rounded-lg border border-[#1a1a3e]/10 bg-white px-2.5 text-sm text-[#1a1a3e]"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 rounded-lg border border-[#1a1a3e]/10 px-2.5 py-1.5 text-sm text-[#1a1a3e]/70">
              <input
                type="checkbox"
                checked={showMock}
                onChange={(e) => setShowMock(e.target.checked)}
                className="size-3.5 accent-[#FF9933]"
              />
              Show demo
            </label>
          </div>
        </div>

        {/* Region chips — 6 Yi zones */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZone("")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              zone === ""
                ? "border-[#FF9933] bg-[#FF9933] text-white"
                : "border-[#1a1a3e]/10 bg-white text-[#1a1a3e]/70 hover:border-[#1a1a3e]/20"
            }`}
          >
            All regions
          </button>
          {YI_ZONES.map((z) => {
            const n = zoneCounts[z.code] ?? 0;
            const active = zone === z.code;
            return (
              <button
                key={z.code}
                type="button"
                onClick={() => setZone(active ? "" : z.code)}
                title={`${z.label} (${z.code})`}
                disabled={n === 0 && !active}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? "border-[#FF9933] bg-[#FF9933] text-white"
                    : "border-[#1a1a3e]/10 bg-white text-[#1a1a3e]/70 hover:border-[#1a1a3e]/20"
                }`}
              >
                {z.label} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>

        {/* Active filters + count */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1a1a3e]/5 pt-2">
          <span className="text-xs text-[#1a1a3e]/45">
            Showing {filtered.length} of {base.length} event{base.length !== 1 ? "s" : ""}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#FF9933] hover:text-[#E68A2E]"
            >
              <X className="size-3" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <EventCardView key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#1a1a3e]/5 bg-white py-14 text-center shadow-sm">
          <p className="text-sm text-[#1a1a3e]/50">No events match your filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#1a1a3e]/10 px-3 py-1.5 text-sm font-medium text-[#1a1a3e]/70 hover:border-[#1a1a3e]/20"
          >
            <X className="size-3.5" /> Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
