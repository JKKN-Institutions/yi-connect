"use client";

import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import {
  getMyDeskRoster,
  volunteerSetDayCheckIn,
  volunteerSetSpeechFinished,
  type DeskRosterMember,
} from "@/app/yip/actions/volunteer-desk";

export function DeskRoster({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<DeskRosterMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // participantId in flight
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    const r = await getMyDeskRoster(eventId);
    if (r.success) setRows(r.data);
    else setErr(r.error);
    setLoaded(true);
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleDay(m: DeskRosterMember, day: 1 | 2) {
    setBusy(m.id);
    setErr(null);
    const next =
      day === 1 ? !m.checked_in_day1 : !m.checked_in_day2;
    setRows((rs) =>
      rs.map((x) => {
        if (x.id !== m.id) return x;
        const d1 = day === 1 ? next : x.checked_in_day1;
        const d2 = day === 2 ? next : x.checked_in_day2;
        return { ...x, checked_in_day1: d1, checked_in_day2: d2, checked_in: d1 || d2 };
      })
    );
    const r = await volunteerSetDayCheckIn(eventId, m.id, day, next);
    setBusy(null);
    if (!r.success) {
      setErr(r.error);
      await refresh();
    }
  }

  async function toggleSpeech(m: DeskRosterMember) {
    setBusy(m.id);
    setErr(null);
    setRows((rs) =>
      rs.map((x) =>
        x.id === m.id ? { ...x, speech_finished: !x.speech_finished } : x
      )
    );
    const r = await volunteerSetSpeechFinished(eventId, m.id, !m.speech_finished);
    setBusy(null);
    if (!r.success) {
      setErr(r.error);
      await refresh();
    }
  }

  if (loaded && rows.length === 0 && !err) {
    return (
      <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-4 py-10 text-center text-sm text-[#1a1a3e]/55 shadow-sm">
        No students at your desk yet.
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.constituency_name ?? "").toLowerCase().includes(q) ||
          String(m.serial_no ?? "").includes(q)
      )
    : rows;

  return (
    <div className="space-y-3">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          {err}
        </div>
      )}
      {/* Search — find a student fast without scrolling the whole desk */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#1a1a3e]/35" />
        <input
          type="text"
          inputMode="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, constituency or number…"
          className="h-11 w-full rounded-xl border border-[#1a1a3e]/12 bg-white pl-9 pr-9 text-sm text-[#1a1a3e] outline-none placeholder:text-[#1a1a3e]/35 focus:border-[#1a1a3e]/30"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-[#1a1a3e]/35 hover:text-[#1a1a3e]/70"
          >
            ×
          </button>
        )}
      </div>
      {q && (
        <p className="px-1 text-xs text-[#1a1a3e]/45">
          {filtered.length} of {rows.length} students
        </p>
      )}
      <ul className="space-y-2">
        {filtered.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-[#1a1a3e]/8 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#1a1a3e]/5 px-1.5 font-[family-name:var(--font-mono)] text-sm font-bold text-[#1a1a3e]/70">
                {m.serial_no ?? "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-[#1a1a3e]">
                  {m.full_name}
                </span>
                {m.constituency_name && (
                  <span className="block truncate text-xs text-[#1a1a3e]/45">
                    {m.constituency_name}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Toggle
                on={m.checked_in_day1}
                disabled={busy === m.id}
                onClick={() => toggleDay(m, 1)}
                labelOn="Day 1"
                labelOff="Day 1"
              />
              <Toggle
                on={m.checked_in_day2}
                disabled={busy === m.id}
                onClick={() => toggleDay(m, 2)}
                labelOn="Day 2"
                labelOff="Day 2"
              />
              <Toggle
                on={m.speech_finished}
                disabled={busy === m.id}
                onClick={() => toggleSpeech(m)}
                labelOn="Speech done"
                labelOff="Speech"
              />
            </div>
          </li>
        ))}
      </ul>
      {q && filtered.length === 0 && (
        <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-4 py-8 text-center text-sm text-[#1a1a3e]/55 shadow-sm">
          No students match “{search}”.
        </div>
      )}
    </div>
  );
}

function Toggle({
  on,
  disabled,
  onClick,
  labelOn,
  labelOff,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        on
          ? "border-[#138808] bg-[#138808]/10 text-[#138808]"
          : "border-[#1a1a3e]/15 bg-white text-[#1a1a3e]/70"
      }`}
    >
      {on ? `✓ ${labelOn}` : labelOff}
    </button>
  );
}
