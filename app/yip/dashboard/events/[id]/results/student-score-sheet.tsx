"use client";

// YIP 2026 — Student-wise Score Sheet (the master scoring grid).
// One row per participant, one column per scoring bucket, then Total /100, Rank,
// Remarks. Bucket subtotals are summed from the stored score_breakdown via
// parentScoreByKey (same source the per-participant drill-down uses); the
// Leadership (Auto) column is the position points derived from parliament_role.
// Total is the authoritative avg_score (the /100). On-screen grid + CSV export.

import { parentScoreByKey } from "@/lib/yip/rubric";
import { ROLE_LABELS } from "@/lib/yip/constants";
import type { ResultWithParticipant } from "@/app/yip/actions/results";
import { Button } from "@/components/yip/ui/button";
import { Download } from "lucide-react";

// Bucket columns in workbook order. `parentKey` is the score_breakdown family
// (null = the Leadership/position column, computed from role bonuses).
const BUCKET_COLUMNS: { key: string; label: string; parentKey: string | null; max: number }[] = [
  { key: "leadership", label: "Leadership (Auto)", parentKey: null, max: 10 },
  { key: "mupi", label: "MUPI / Opening", parentKey: "mupi", max: 15 },
  { key: "qh", label: "Question Hour", parentKey: "qh", max: 20 },
  { key: "zero", label: "Zero Hour", parentKey: "zero", max: 15 },
  { key: "pol", label: "Political Acumen", parentKey: "pol", max: 10 },
  { key: "cmte", label: "Committee Drafting", parentKey: "cmte", max: 15 },
  { key: "bill", label: "Bill Presentation", parentKey: "bill", max: 15 },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function partyLabel(p: ResultWithParticipant["participant"]): string {
  return p.party_number != null
    ? String.fromCharCode(64 + p.party_number)
    : p.party_side ?? "";
}

function leadershipPoints(
  role: string | null,
  bonuses: Record<string, number>
): number {
  if (!role) return 0;
  return Math.min(10, Math.max(0, bonuses[role] ?? 0));
}

function bucketValue(
  r: ResultWithParticipant,
  parentKey: string | null,
  bonuses: Record<string, number>
): number {
  if (parentKey === null) {
    return leadershipPoints(r.participant.parliament_role, bonuses);
  }
  return round2(parentScoreByKey(r.score_breakdown ?? {}, parentKey));
}

export function StudentScoreSheet({
  results,
  positionBonuses,
  eventName,
}: {
  results: ResultWithParticipant[];
  positionBonuses: Record<string, number>;
  eventName: string;
}) {
  function exportCsv() {
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Rank",
      "Constituency No",
      "Student Name",
      "Constituency",
      "Party",
      "Committee",
      "Position Secured",
      ...BUCKET_COLUMNS.map((b) => `${b.label} (${b.max})`),
      "Total Score (100)",
      "Remarks",
    ];
    const lines = results.map((r) => {
      const p = r.participant;
      return [
        r.rank ?? "",
        p.constituency_number ?? "",
        p.full_name,
        p.constituency_name ?? "",
        partyLabel(p),
        p.committee_name ?? p.committee_number ?? "",
        p.parliament_role && p.parliament_role !== "mp"
          ? ROLE_LABELS[p.parliament_role] ?? p.parliament_role
          : "No Position",
        ...BUCKET_COLUMNS.map((b) => bucketValue(r, b.parentKey, positionBonuses)),
        r.avg_score ?? "",
        r.award_category ?? "",
      ]
        .map(esc)
        .join(",");
    });
    const csv = [header.map(esc).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/[^a-zA-Z0-9]/g, "_")}_score_sheet.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#1a1a3e]/50">
        No computed results yet. Run Compute Results on the Scoring tab.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#1a1a3e]/60">
          Per-student scores across all sessions. Total is the official /100;
          bucket columns sum each session&apos;s criteria.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          className="shrink-0"
        >
          <Download className="mr-1.5 size-4" />
          Score Sheet CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#1a1a3e]/10">
        <table className="w-full min-w-[1100px] border-collapse text-xs">
          <thead>
            <tr className="bg-[#1a1a3e] text-white">
              <th className="px-2 py-2 text-center font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Const. No</th>
              <th className="px-2 py-2 text-left font-semibold">Student</th>
              <th className="px-2 py-2 text-left font-semibold">Constituency</th>
              <th className="px-2 py-2 text-center font-semibold">Party</th>
              <th className="px-2 py-2 text-left font-semibold">Committee</th>
              <th className="px-2 py-2 text-left font-semibold">Position</th>
              {BUCKET_COLUMNS.map((b) => (
                <th
                  key={b.key}
                  className="px-2 py-2 text-right font-semibold"
                  title={`Max ${b.max}`}
                >
                  {b.label}
                  <span className="block text-[10px] font-normal text-white/60">
                    /{b.max}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-bold">Total /100</th>
              <th className="px-2 py-2 text-left font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const p = r.participant;
              return (
                <tr
                  key={r.id}
                  className={
                    i % 2 === 0 ? "bg-white" : "bg-[#1a1a3e]/[0.025]"
                  }
                >
                  <td className="px-2 py-1.5 text-center font-mono text-[#1a1a3e]/70">
                    {r.rank ?? ""}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[#1a1a3e]/70">
                    {p.constituency_number ?? ""}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-[#1a1a3e]">
                    {p.full_name}
                  </td>
                  <td className="px-2 py-1.5 text-[#1a1a3e]/80">
                    {p.constituency_name ?? ""}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[#1a1a3e]/80">
                    {partyLabel(p)}
                  </td>
                  <td className="px-2 py-1.5 text-[#1a1a3e]/80">
                    {p.committee_name ?? p.committee_number ?? ""}
                  </td>
                  <td className="px-2 py-1.5 text-[#1a1a3e]/70">
                    {p.parliament_role && p.parliament_role !== "mp"
                      ? ROLE_LABELS[p.parliament_role] ?? p.parliament_role
                      : "—"}
                  </td>
                  {BUCKET_COLUMNS.map((b) => {
                    const v = bucketValue(r, b.parentKey, positionBonuses);
                    return (
                      <td
                        key={b.key}
                        className="px-2 py-1.5 text-right tabular-nums text-[#1a1a3e]/80"
                      >
                        {v ? v : <span className="text-[#1a1a3e]/30">0</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#1a1a3e]">
                    {r.avg_score != null ? round2(r.avg_score) : ""}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-[#FF9933]">
                    {r.award_category ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
