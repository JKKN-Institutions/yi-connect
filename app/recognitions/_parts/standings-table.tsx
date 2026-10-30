"use client";

import { useState } from "react";
import { WORDS } from "@/lib/recognitions/constants";
import { rankMoved, reasonRequired, sortStandings, type StandingSortKey as SortKey } from "@/lib/recognitions/moderation-rules";
import { WordField } from "../_ui/client";
import { fmt } from "./combined-matrix";
import { matrixRankLabel } from "./shared";
import { HomeNote, type HomeNotes } from "./home-note";

/** One chapter of a category on the Stage 2 table. Plain data. */
export type StandingRow = {
  nominationId: string;
  chapterName: string;
  region: string;
  /** Points out of each part's weight (50 / 25 / 25): they add up to total. */
  partAPoints: number;
  rmPoints: number;
  nmtPoints: number;
  total: number;
  /** The combined matrix's rank (ties share it) and how many chapters share it. */
  matrixRank: number;
  tieSize: number;
  /** Plain-English names of the parts with no marks yet. */
  missing: string[];
};

/**
 * The NMT leader's Stage 2 table, per category (Piyush's sketch, 30 Oct 2026):
 * Chapter | Health Card (Part A) | RM | NMT | Total | Rank | Final Rank | Reason.
 * Click a score header to sort by it (descending; Rank ascending); Total is
 * the default. With `edit` the final rank is a dropdown 1..N and the reason a
 * text box; without it (read-only) the same table shows `final` as text.
 * The table sits in its own horizontal scroll so a phone page never scrolls
 * sideways.
 */
export function StandingsTable({
  label,
  weights,
  rows,
  home,
  edit,
  final,
}: {
  label: string;
  weights: { l1: number; l2: number; l3: number };
  rows: StandingRow[];
  home?: HomeNotes;
  edit?: {
    ranks: Record<string, string>;
    reasons: Record<string, string>;
    setRank: (id: string, v: string) => void;
    setReason: (id: string, v: string) => void;
  };
  final?: Record<string, { rank: number | null; reason: string }>;
}) {
  const [sort, setSort] = useState<SortKey>("total");
  const n = rows.length;
  const sorted = sortStandings(rows, sort);

  const head = (key: SortKey, text: string, share?: number) => (
    <th className="rx-num" aria-sort={sort === key ? (key === "rank" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="rx-st-sort"
        data-active={sort === key ? "true" : undefined}
        onClick={() => setSort(key)}
        title={`Sort by ${text}`}
      >
        {text}
        {share !== undefined ? <span className="rx-st-share">{share}%</span> : null}
        <span aria-hidden="true">{sort === key ? (key === "rank" ? " ↑" : " ↓") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="rx-ledger-wrap rx-st-wrap">
      <table className="rx-ledger rx-st" aria-label={`${label}: chapters, scores and final ranks`}>
        <thead>
          <tr>
            <th>Chapter</th>
            {head("partA", "Health Card Score · Part A", weights.l1)}
            {head("rm", "RM Score", weights.l2)}
            {head("nmt", "NMT Score", weights.l3)}
            {head("total", "Total")}
            {head("rank", "Rank")}
            <th className="rx-num">Final Rank</th>
            <th>Reason for Choice</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const rankText = edit ? (edit.ranks[r.nominationId] ?? "").trim() : String(final?.[r.nominationId]?.rank ?? "");
            const k = rankText === "" ? null : Number(rankText);
            const moved = k !== null && Number.isInteger(k) && rankMoved(k, r.matrixRank, r.tieSize);
            const required = k !== null && Number.isInteger(k) && reasonRequired(k, r.matrixRank, r.tieSize);
            return (
              <tr key={r.nominationId} data-moved={moved ? "true" : undefined}>
                <td className="rx-st-chapter">
                  <strong>{r.chapterName}</strong>
                  <div className="rx-small rx-mute">{r.region}</div>
                  <HomeNote names={home?.[r.chapterName]} />
                  {r.missing.length > 0 ? <div className="rx-small rx-p-flag">Missing: {r.missing.join(", ")}</div> : null}
                </td>
                <td className="rx-num">{fmt(r.partAPoints)}</td>
                <td className="rx-num">{fmt(r.rmPoints)}</td>
                <td className="rx-num">{fmt(r.nmtPoints)}</td>
                <td className="rx-num rx-p-total">{fmt(r.total)}</td>
                <td className="rx-num">{matrixRankLabel(r.matrixRank, r.tieSize)}</td>
                <td className="rx-num">
                  {edit ? (
                    <select
                      className="rx-input rx-st-select"
                      aria-label={`Final rank for ${r.chapterName}`}
                      value={edit.ranks[r.nominationId] ?? ""}
                      onChange={(e) => edit.setRank(r.nominationId, e.target.value)}
                    >
                      <option value="">Choose</option>
                      {Array.from({ length: n }, (_, i) => i + 1).map((i) => (
                        <option key={i} value={String(i)}>
                          {i}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <strong>{k ?? "—"}</strong>
                  )}
                  {moved ? (
                    <span className="rx-small rx-rank-move" style={{ display: "block", whiteSpace: "nowrap" }}>
                      {k! < r.matrixRank ? "Up" : "Down"}
                    </span>
                  ) : null}
                </td>
                <td className="rx-st-reason">
                  {edit ? (
                    <WordField
                      label={`Reason for ${r.chapterName}`}
                      value={edit.reasons[r.nominationId] ?? ""}
                      onChange={(v) => edit.setReason(r.nominationId, v)}
                      limit={WORDS.rankReason}
                      rows={2}
                      help={
                        required
                          ? moved
                            ? "Required: the rank moved from the provisional rank."
                            : "Required for final ranks 1 to 5."
                          : "Optional."
                      }
                    />
                  ) : (final?.[r.nominationId]?.reason ?? "").trim() !== "" ? (
                    <p className="rx-small rx-p-text" style={{ margin: 0 }}>{final![r.nominationId].reason}</p>
                  ) : (
                    <span className="rx-small rx-mute">No reason written</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
