"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/yip/ui/input";
import { Search, Users, CalendarDays, Landmark, Loader2 } from "lucide-react";
import { searchEverything } from "@/app/yip/actions/global-search";

type SearchResults = Extract<
  Awaited<ReturnType<typeof searchEverything>>,
  { success: true }
>["results"];

const EMPTY: SearchResults = { participants: [], events: [], ministries: [] };

function GroupHeading({ label }: { label: string }) {
  return (
    <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a1a3e]/40">
      {label}
    </p>
  );
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guard against out-of-order responses: only the latest request may land.
  const seqRef = useRef(0);

  // Debounced (300ms) search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++seqRef.current;
    const t = setTimeout(async () => {
      const res = await searchEverything(q);
      if (seq !== seqRef.current) return; // a newer query superseded this one
      setLoading(false);
      setResults(res.success ? res.results : EMPTY);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Click-away closes.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const hasAny =
    results.participants.length > 0 ||
    results.events.length > 0 ||
    results.ministries.length > 0;

  return (
    <div
      ref={containerRef}
      className="relative mb-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#1a1a3e]/30" />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#FF9933]" />
        )}
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          placeholder="Search members, events and ministries…"
          aria-label="Search members, events and ministries"
          className="h-11 rounded-xl border-[#1a1a3e]/10 bg-white pl-10 pr-10 shadow-sm placeholder:text-[#1a1a3e]/35 focus-visible:border-[#FF9933]/50 focus-visible:ring-[#FF9933]/20"
        />
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-[26rem] overflow-y-auto rounded-xl border border-[#1a1a3e]/10 bg-white pb-2 shadow-lg">
          {!hasAny ? (
            <p className="px-4 py-6 text-center text-sm text-[#1a1a3e]/45">
              No matches in your chapters
            </p>
          ) : (
            <>
              {results.participants.length > 0 && (
                <div>
                  <GroupHeading label="Participants" />
                  {results.participants.map((p) => (
                    <Link
                      key={p.id}
                      href={`/yip/dashboard/events/${p.eventId}/participants`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[#FF9933]/5"
                    >
                      <Users className="size-4 shrink-0 text-[#FF9933]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[#1a1a3e]">
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-[#1a1a3e]/45">
                          {[p.constituencyName, p.eventName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {results.events.length > 0 && (
                <div>
                  <GroupHeading label="Events" />
                  {results.events.map((e) => (
                    <Link
                      key={e.id}
                      href={`/yip/dashboard/events/${e.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[#FF9933]/5"
                    >
                      <CalendarDays className="size-4 shrink-0 text-[#138808]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[#1a1a3e]">
                          {e.name}
                        </span>
                        <span className="block truncate text-xs text-[#1a1a3e]/45">
                          {[e.chapterName, e.status.replaceAll("_", " ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {results.ministries.length > 0 && (
                <div>
                  <GroupHeading label="Ministries" />
                  {results.ministries.map((m) => (
                    <Link
                      key={`${m.eventId}-${m.key}`}
                      href={`/yip/dashboard/events/${m.eventId}/cabinet`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[#FF9933]/5"
                    >
                      <Landmark className="size-4 shrink-0 text-[#1a1a3e]/60" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[#1a1a3e]">
                          {m.label}
                        </span>
                        <span className="block truncate text-xs text-[#1a1a3e]/45">
                          {m.eventName}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
