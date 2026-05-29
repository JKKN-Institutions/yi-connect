"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMatch } from "./actions";

interface MatchRegistrant {
  id: string;
  full_name: string | null;
  organisation: string | null;
  sector: string | null;
}

export interface MatchRow {
  id: string;
  match_reason: string | null;
  match_score: number | null;
  slot_time: string | null;
  table_number: number | null;
  is_walkup: boolean;
  a_confirmed: boolean;
  b_confirmed: boolean;
  meeting_happened: boolean;
  registrant_a: MatchRegistrant | null;
  registrant_b: MatchRegistrant | null;
}

/**
 * Convert an ISO timestamp into the "YYYY-MM-DDTHH:mm" shape that an
 * <input type="datetime-local"> expects, in local time. Returns "" for null
 * or unparseable values so the control renders blank.
 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function MatchesTable({ rows }: { rows: MatchRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <MatchCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function MatchCard({ row }: { row: MatchRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>(toDatetimeLocal(row.slot_time));
  const [table, setTable] = useState<string>(
    row.table_number != null ? String(row.table_number) : ""
  );

  const aName = row.registrant_a?.full_name ?? "TBA";
  const bName = row.registrant_b?.full_name ?? "TBA";

  function handleSave() {
    setError(null);
    setSaved(false);
    const slotValue = slot.trim() ? slot : null;
    const tableValue = table.trim() ? Number(table) : null;

    startTransition(async () => {
      const res = await updateMatch(row.id, slotValue, tableValue);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div
      className={`bg-white/5 border rounded-xl p-4 transition-colors ${
        row.meeting_happened
          ? "border-[#229434]/30 bg-[#229434]/5"
          : "border-white/10"
      }`}
    >
      {/* Header: A ↔ B */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">
            {aName} <span className="text-[#FD7215]">↔</span> {bName}
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {[row.registrant_a?.organisation, row.registrant_a?.sector]
              .filter(Boolean)
              .join(" · ") || "—"}
            <span className="text-white/30"> &nbsp;↔&nbsp; </span>
            {[row.registrant_b?.organisation, row.registrant_b?.sector]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          {row.is_walkup && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              Walk-up
            </span>
          )}
          {row.meeting_happened && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#229434]/20 text-[#229434]">
              Met ✓
            </span>
          )}
          {row.a_confirmed && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FD7215]/20 text-[#FD7215]">
              A confirmed
            </span>
          )}
          {row.b_confirmed && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FD7215]/20 text-[#FD7215]">
              B confirmed
            </span>
          )}
        </div>
      </div>

      {/* Reason + score */}
      {(row.match_reason || row.match_score != null) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {row.match_reason && (
            <p className="text-white/40 text-xs">{row.match_reason}</p>
          )}
          {row.match_score != null && (
            <span className="text-white/30 text-xs">
              score {row.match_score.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Inline edit controls */}
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/10 pt-3">
        <div>
          <label
            htmlFor={`slot-${row.id}`}
            className="block text-xs font-medium text-white/50 mb-1"
          >
            Slot time
          </label>
          <input
            id={`slot-${row.id}`}
            type="datetime-local"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-[#FD7215]/50 [color-scheme:dark]"
          />
        </div>
        <div>
          <label
            htmlFor={`table-${row.id}`}
            className="block text-xs font-medium text-white/50 mb-1"
          >
            Table #
          </label>
          <input
            id={`table-${row.id}`}
            type="number"
            min="1"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="—"
            className="w-24 bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-[#FD7215]/50"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="px-4 py-2 bg-[#FD7215] hover:bg-[#FD7215]/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="text-[#229434] text-xs font-medium">Saved ✓</span>
        )}
        {error && <span className="text-red-300 text-xs">{error}</span>}
      </div>
    </div>
  );
}
