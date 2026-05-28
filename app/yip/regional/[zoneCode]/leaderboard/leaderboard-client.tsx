"use client";

import { useMemo, useState } from "react";
import type { RegionalLeaderboardRow } from "@/app/yip/actions/regional";

type SortKey =
  | "rank"
  | "total_score"
  | "events_played"
  | "awards_won"
  | "speaker_count"
  | "best_event_score";

const COLUMNS: Array<{
  key: SortKey;
  label: string;
  abbr: string;
  help: string;
  numeric: boolean;
}> = [
  {
    key: "events_played",
    label: "Events Played",
    abbr: "EP",
    help: "Chapter rounds entered",
    numeric: true,
  },
  {
    key: "total_score",
    label: "Total Score",
    abbr: "TS",
    help: "Sum of average scores across events",
    numeric: true,
  },
  {
    key: "best_event_score",
    label: "Best Score",
    abbr: "BS",
    help: "Best single-event average score",
    numeric: true,
  },
  {
    key: "awards_won",
    label: "Awards",
    abbr: "AW",
    help: "Award categories won",
    numeric: true,
  },
  {
    key: "speaker_count",
    label: "Leadership",
    abbr: "LD",
    help: "Times in a leadership role (PM, Speaker, LoP, Minister, ...)",
    numeric: true,
  },
];

export function LeaderboardClient({
  rows,
  zoneLabel,
}: {
  rows: RegionalLeaderboardRow[];
  zoneLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const filtered = filter.trim()
      ? rows.filter((r) => {
          const q = filter.toLowerCase();
          return (
            r.full_name.toLowerCase().includes(q) ||
            r.school_name.toLowerCase().includes(q) ||
            r.chapter_name.toLowerCase().includes(q)
          );
        })
      : rows;

    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "rank") return 0; // handled by original order
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av === bv ? 0 : av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, filter]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="mt-6">
      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Search ${zoneLabel} — name, school, chapter…`}
          className="w-full rounded-lg border border-[#1a1a3e]/10 bg-white px-4 py-2.5 text-sm text-[#1a1a3e] placeholder-[#1a1a3e]/30 shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/20 sm:max-w-md"
        />
        <span className="text-xs uppercase tracking-[0.15em] text-[#1a1a3e]/40">
          Showing {sorted.length} of {rows.length}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a3e] text-white">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em]">
                #
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em]">
                Participant
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em]">
                Chapter
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    title={col.help}
                    className={`inline-flex items-center gap-1 transition-colors ${
                      sortKey === col.key
                        ? "text-[#FF9933]"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {col.abbr}
                    {sortKey === col.key && (
                      <span className="text-[10px]">
                        {sortDir === "desc" ? "▼" : "▲"}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={row.person_id}
                className={`border-t border-[#1a1a3e]/5 transition-colors hover:bg-[#FF9933]/[0.03] ${
                  idx < 3 ? "bg-[#FF9933]/[0.02]" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <RankBadge rank={idx + 1} />
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-[#1a1a3e]">
                    {row.full_name}
                  </div>
                  <div className="text-xs text-[#1a1a3e]/50">
                    {row.school_name}
                  </div>
                </td>
                <td className="px-3 py-3 text-[#1a1a3e]/70">
                  {row.chapter_name || "—"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[#1a1a3e]">
                  {row.events_played}
                </td>
                <td className="px-3 py-3 text-right font-[family-name:var(--font-heading)] text-base font-bold tabular-nums text-[#1a1a3e]">
                  {row.total_score.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[#1a1a3e]/70">
                  {row.best_event_score.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[#1a1a3e]/70">
                  {row.awards_won > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#138808]/10 px-2 py-0.5 text-xs font-semibold text-[#138808]">
                      {row.awards_won}
                    </span>
                  ) : (
                    <span className="text-[#1a1a3e]/30">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[#1a1a3e]/70">
                  {row.speaker_count > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9933]/10 px-2 py-0.5 text-xs font-semibold text-[#FF9933]">
                      {row.speaker_count}
                    </span>
                  ) : (
                    <span className="text-[#1a1a3e]/30">0</span>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={3 + COLUMNS.length}
                  className="px-3 py-12 text-center text-sm text-[#1a1a3e]/40"
                >
                  No participants match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {/* Sort selector for mobile */}
        <div className="flex flex-wrap gap-2">
          {COLUMNS.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => handleSort(col.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sortKey === col.key
                  ? "border-[#FF9933] bg-[#FF9933] text-white"
                  : "border-[#1a1a3e]/10 bg-white text-[#1a1a3e]/70"
              }`}
            >
              {col.abbr}
              {sortKey === col.key ? (sortDir === "desc" ? " ▼" : " ▲") : ""}
            </button>
          ))}
        </div>

        {sorted.map((row, idx) => (
          <div
            key={row.person_id}
            className={`rounded-xl border border-[#1a1a3e]/5 bg-white p-4 shadow-sm ${
              idx < 3 ? "border-l-4 border-l-[#FF9933]" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <RankBadge rank={idx + 1} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#1a1a3e]">
                    {row.full_name}
                  </div>
                  <div className="truncate text-xs text-[#1a1a3e]/50">
                    {row.school_name}
                  </div>
                  <div className="truncate text-[11px] uppercase tracking-wider text-[#1a1a3e]/40">
                    {row.chapter_name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-[family-name:var(--font-heading)] text-xl font-bold leading-none text-[#1a1a3e]">
                  {row.total_score.toFixed(1)}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#1a1a3e]/40">
                  Total
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[#1a1a3e]/5 pt-3 text-center">
              <MiniStat label="EP" value={row.events_played} />
              <MiniStat label="BS" value={row.best_event_score.toFixed(1)} />
              <MiniStat
                label="AW"
                value={row.awards_won}
                accent={row.awards_won > 0 ? "#138808" : undefined}
              />
              <MiniStat
                label="LD"
                value={row.speaker_count}
                accent={row.speaker_count > 0 ? "#FF9933" : undefined}
              />
            </div>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#1a1a3e]/15 bg-white/50 px-6 py-12 text-center text-sm text-[#1a1a3e]/40">
            No participants match your search.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 rounded-xl border border-[#1a1a3e]/5 bg-white p-4 text-xs text-[#1a1a3e]/60">
        <span className="font-semibold uppercase tracking-[0.1em] text-[#1a1a3e]/40">
          Legend ·{" "}
        </span>
        {COLUMNS.map((c, i) => (
          <span key={c.key}>
            {i > 0 ? " · " : ""}
            <span className="font-semibold text-[#1a1a3e]">{c.abbr}</span>{" "}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-[#FF9933] text-white"
      : rank === 2
        ? "bg-[#1a1a3e] text-white"
        : rank === 3
          ? "bg-[#138808] text-white"
          : "bg-[#1a1a3e]/5 text-[#1a1a3e]/70";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${styles}`}
    >
      {rank}
    </span>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div>
      <div
        className="font-[family-name:var(--font-heading)] text-sm font-bold tabular-nums"
        style={{ color: accent ?? "#1a1a3e" }}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-[#1a1a3e]/40">
        {label}
      </div>
    </div>
  );
}
