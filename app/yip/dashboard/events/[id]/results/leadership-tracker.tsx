"use client";

// YIP 2026 — Leadership Tracker. Every participant holding a leadership position
// (Speaker / Cabinet / Party / Committee leadership — i.e. parliament_role other
// than plain MP), with the position points auto-awarded from their role. This is
// the platform's record of the manual "Leadership Score Tracker" sheet: the
// position itself is won in-app (elections) and the points follow automatically,
// so there's nothing to enter by hand — this view just reports it.

import { ROLE_LABELS } from "@/lib/yip/constants";
import type { ResultWithParticipant } from "@/app/yip/actions/results";
import { Button } from "@/components/yip/ui/button";
import { Download } from "lucide-react";

const round2 = (n: number) => Math.round(n * 100) / 100;

function partyLabel(p: ResultWithParticipant["participant"]): string {
  return p.party_number != null
    ? String.fromCharCode(64 + p.party_number)
    : p.party_side ?? "";
}

function positionPoints(
  role: string | null,
  bonuses: Record<string, number>
): number {
  if (!role) return 0;
  return Math.min(10, Math.max(0, bonuses[role] ?? 0));
}

export function LeadershipTracker({
  results,
  positionBonuses,
  eventName,
}: {
  results: ResultWithParticipant[];
  positionBonuses: Record<string, number>;
  eventName: string;
}) {
  // Position holders = anyone with a parliament_role that isn't plain MP.
  const holders = results
    .filter(
      (r) =>
        r.participant.parliament_role &&
        r.participant.parliament_role !== "mp"
    )
    .sort(
      (a, b) =>
        positionPoints(b.participant.parliament_role, positionBonuses) -
        positionPoints(a.participant.parliament_role, positionBonuses)
    );

  function exportCsv() {
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Position",
      "Constituency No",
      "Student Name",
      "Constituency",
      "Party",
      "Committee",
      "Position Points",
      "Total Score (100)",
      "Decided By",
    ];
    const lines = holders.map((r) => {
      const p = r.participant;
      return [
        ROLE_LABELS[p.parliament_role!] ?? p.parliament_role,
        p.constituency_number ?? "",
        p.full_name,
        p.constituency_name ?? "",
        partyLabel(p),
        p.committee_name ?? p.committee_number ?? "",
        positionPoints(p.parliament_role, positionBonuses),
        r.avg_score ?? "",
        "In-app election / role assignment",
      ]
        .map(esc)
        .join(",");
    });
    const csv = [header.map(esc).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/[^a-zA-Z0-9]/g, "_")}_leadership_tracker.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (holders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#1a1a3e]/50">
        No leadership positions assigned yet. Positions are won live during the
        event (Speaker election, Cabinet, Party leaders) — they&apos;ll appear
        here automatically with their points.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#1a1a3e]/60">
          Position points are awarded automatically from each role — the in-app
          election record is the backup evidence.
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv} className="shrink-0">
          <Download className="mr-1.5 size-4" />
          Leadership Tracker CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#1a1a3e]/10">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1a3e] text-white">
              <th className="px-3 py-2 text-left font-semibold">Position</th>
              <th className="px-3 py-2 text-left font-semibold">Const. No</th>
              <th className="px-3 py-2 text-left font-semibold">Student</th>
              <th className="px-3 py-2 text-left font-semibold">Constituency</th>
              <th className="px-3 py-2 text-center font-semibold">Party</th>
              <th className="px-3 py-2 text-left font-semibold">Committee</th>
              <th className="px-3 py-2 text-right font-semibold">Points</th>
              <th className="px-3 py-2 text-right font-semibold">Total /100</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((r, i) => {
              const p = r.participant;
              return (
                <tr
                  key={r.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#1a1a3e]/[0.025]"}
                >
                  <td className="px-3 py-2 font-medium text-[#1a1a3e]">
                    {ROLE_LABELS[p.parliament_role!] ?? p.parliament_role}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#1a1a3e]/70">
                    {p.constituency_number ?? ""}
                  </td>
                  <td className="px-3 py-2 text-[#1a1a3e]">{p.full_name}</td>
                  <td className="px-3 py-2 text-[#1a1a3e]/80">
                    {p.constituency_name ?? ""}
                  </td>
                  <td className="px-3 py-2 text-center text-[#1a1a3e]/80">
                    {partyLabel(p)}
                  </td>
                  <td className="px-3 py-2 text-[#1a1a3e]/80">
                    {p.committee_name ?? p.committee_number ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[#138808]">
                    +{positionPoints(p.parliament_role, positionBonuses)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#1a1a3e]/80">
                    {r.avg_score != null ? round2(r.avg_score) : ""}
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
