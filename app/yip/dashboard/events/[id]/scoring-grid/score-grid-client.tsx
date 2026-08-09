"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  GridCell,
  ScoreGridData,
} from "@/app/yip/actions/scores-grid";
import { ROLE_LABELS } from "@/lib/yip/constants";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  Check,
  Grid3x3,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { INK, SAFFRON, SERIF, inkA } from "@/app/yip/me/credential-ui";

// Organiser coverage matrix. Rows = participants by Const. No. (NUMBERS ONLY —
// no names anywhere in this component; the payload doesn't even contain them).
// Columns = jurors of the selected session. Cells = submitted score / draft /
// missing. Built to be glanceable on a projector during the event.

function formatRelative(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

/** Hydration-safe relative time (SSR renders a stable placeholder). */
function FetchedAt({ dateStr }: { dateStr: string }) {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    setLabel(formatRelative(dateStr));
  }, [dateStr]);
  return <span suppressHydrationWarning>{label}</span>;
}

export function ScoreGridClient({
  eventId,
  data,
}: {
  eventId: string;
  data: ScoreGridData;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { participants, jurors, sessions, grids, revealScores } = data;

  // Session selector — defaults to the first session (day/sequence order).
  const [sessionId, setSessionId] = useState<string | null>(
    sessions[0]?.id ?? null
  );
  // If a refresh removed the selected session, fall back to the first one.
  const activeSessionId =
    sessionId && sessions.some((s) => s.id === sessionId)
      ? sessionId
      : sessions[0]?.id ?? null;

  const jurorById = useMemo(
    () => new Map(jurors.map((j) => [j.id, j])),
    [jurors]
  );

  const grid = grids.find((g) => g.session_id === activeSessionId) ?? null;

  // Cell lookup + per-row / per-column tallies for the active session.
  const { cellByKey, perJuror, perParticipant, filled, drafts } = useMemo(() => {
    const cellByKey = new Map<string, GridCell>();
    const perJuror = new Map<string, number>();
    const perParticipant = new Map<string, number>();
    let filled = 0;
    let drafts = 0;
    if (grid) {
      for (const c of grid.cells) {
        cellByKey.set(`${c.participant_id}|${c.jury_assignment_id}`, c);
        if (c.status === "submitted") {
          filled++;
          perJuror.set(
            c.jury_assignment_id,
            (perJuror.get(c.jury_assignment_id) ?? 0) + 1
          );
          perParticipant.set(
            c.participant_id,
            (perParticipant.get(c.participant_id) ?? 0) + 1
          );
        } else {
          drafts++;
        }
      }
    }
    return { cellByKey, perJuror, perParticipant, filled, drafts };
  }, [grid]);

  const columnJurors = (grid?.juror_ids ?? [])
    .map((id) => jurorById.get(id))
    .filter((j): j is NonNullable<typeof j> => Boolean(j));

  const totalCells = participants.length * columnJurors.length;
  const missing = Math.max(0, totalCells - filled - drafts);
  const coveragePct =
    totalCells > 0 ? Math.round((filled / totalCells) * 100) : 0;

  /** Row label: the constituency number is THE identity on this board. */
  const rowLabel = (p: (typeof participants)[number]) =>
    p.constituency_number != null
      ? `#${p.constituency_number}`
      : p.serial_no != null
        ? `S${p.serial_no}`
        : "—";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            SCORING
          </p>
          <h2
            className="mt-0.5 flex items-center gap-2 text-lg font-semibold tracking-tight"
            style={{ ...SERIF, color: INK }}
          >
            <Grid3x3 className="size-4" style={{ color: SAFFRON }} />
            Score Grid
          </h2>
          <p className="text-sm" style={{ color: inkA(0.5) }}>
            Who has scored whom, per session — participants shown by seat
            number only, safe to project.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: inkA(0.4) }}>
            Updated <FetchedAt dateStr={data.fetched_at} />
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {data.event.scores_locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <Lock className="size-4 shrink-0" />
          Scores are locked for this event.
        </div>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            No scoreable sessions yet. Turn scoring on for a session in the
            Jury tab first.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Session selector */}
          <div className="flex flex-wrap gap-1.5">
            {sessions.map((s) => {
              const active = s.id === activeSessionId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSessionId(s.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#FF9933] bg-[#FF9933]/10 text-[#9a5212]"
                      : "border-[#1a1a3e]/15 bg-white text-[#1a1a3e]/60 hover:border-[#1a1a3e]/30 hover:text-[#1a1a3e]"
                  }`}
                >
                  {s.day > 0 && (
                    <span className="mr-1 opacity-60">D{s.day}</span>
                  )}
                  {s.title}
                </button>
              );
            })}
          </div>

          {/* Coverage stats for the selected session */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span style={{ color: inkA(0.7) }}>
              <span className="font-semibold tabular-nums" style={{ color: INK }}>
                {filled}
              </span>{" "}
              of <span className="tabular-nums">{totalCells}</span> scored (
              {coveragePct}%)
            </span>
            {drafts > 0 && (
              <span className="text-amber-600">
                <span className="font-semibold tabular-nums">{drafts}</span>{" "}
                draft{drafts === 1 ? "" : "s"}
              </span>
            )}
            <span className={missing > 0 ? "text-red-600" : "text-green-600"}>
              <span className="font-semibold tabular-nums">{missing}</span>{" "}
              missing
            </span>
            {!revealScores && (
              <span className="text-xs" style={{ color: inkA(0.4) }}>
                Score values are visible to the chapter chair and national
                admins — this board shows coverage.
              </span>
            )}
          </div>

          {/* The matrix */}
          {participants.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-gray-500">
                No participants with assigned roles yet. Run allocation first.
              </CardContent>
            </Card>
          ) : columnJurors.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-gray-500">
                No active jurors for this session. Assign jurors in the Jury
                tab first.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#1a1a3e]/10 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.03]">
                    <th
                      className="sticky left-0 z-10 bg-[#f7f7f9] px-3 py-2 text-left text-xs font-semibold"
                      style={{ color: inkA(0.6) }}
                    >
                      Const.
                    </th>
                    {columnJurors.map((j) => (
                      <th
                        key={j.id}
                        className="min-w-[64px] px-2 py-2 text-center text-xs font-semibold"
                        style={{ color: inkA(0.6) }}
                        title={j.jury_name}
                      >
                        <span className="block max-w-[110px] truncate">
                          {j.jury_name}
                        </span>
                      </th>
                    ))}
                    <th
                      className="px-3 py-2 text-center text-xs font-semibold"
                      style={{ color: inkA(0.6) }}
                    >
                      Done
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => {
                    const done = perParticipant.get(p.id) ?? 0;
                    const rowComplete = done >= columnJurors.length;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[#1a1a3e]/5 last:border-b-0"
                      >
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5">
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: INK }}
                          >
                            {rowLabel(p)}
                          </span>
                          {p.parliament_role &&
                            p.parliament_role !== "member" && (
                              <Badge
                                variant="secondary"
                                className="ml-1.5 px-1.5 py-0 text-[10px]"
                              >
                                {ROLE_LABELS[p.parliament_role] ??
                                  p.parliament_role}
                              </Badge>
                            )}
                          {p.party_number != null && (
                            <span
                              className="ml-1.5 text-[10px]"
                              style={{ color: inkA(0.35) }}
                            >
                              Party {String.fromCharCode(64 + p.party_number)}
                            </span>
                          )}
                        </td>
                        {columnJurors.map((j) => {
                          const cell = cellByKey.get(`${p.id}|${j.id}`);
                          if (!cell) {
                            return (
                              <td
                                key={j.id}
                                className="bg-red-50/70 px-2 py-1.5 text-center text-red-300"
                                aria-label="not scored"
                              >
                                —
                              </td>
                            );
                          }
                          if (cell.status === "draft") {
                            return (
                              <td
                                key={j.id}
                                className="bg-amber-50 px-2 py-1.5 text-center text-[11px] font-medium text-amber-600"
                                aria-label="draft"
                              >
                                {revealScores && cell.total != null
                                  ? `(${cell.total})`
                                  : "draft"}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={j.id}
                              className="bg-green-50/60 px-2 py-1.5 text-center font-mono text-[13px] font-medium text-green-700"
                              aria-label="scored"
                            >
                              {revealScores && cell.total != null ? (
                                <>
                                  {cell.total}
                                  {cell.turns > 1 && (
                                    <span className="ml-0.5 align-super text-[9px] text-green-500">
                                      ×{cell.turns}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <Check className="mx-auto size-3.5" />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-1.5 text-center">
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              rowComplete
                                ? "text-green-600"
                                : done > 0
                                  ? "text-amber-600"
                                  : "text-red-500"
                            }`}
                          >
                            {done}/{columnJurors.length}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.03]">
                    <td
                      className="sticky left-0 z-10 bg-[#f7f7f9] px-3 py-2 text-xs font-semibold"
                      style={{ color: inkA(0.6) }}
                    >
                      Scored
                    </td>
                    {columnJurors.map((j) => {
                      const n = perJuror.get(j.id) ?? 0;
                      const complete = n >= participants.length;
                      return (
                        <td key={j.id} className="px-2 py-2 text-center">
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              complete
                                ? "text-green-600"
                                : n > 0
                                  ? "text-amber-600"
                                  : "text-red-500"
                            }`}
                          >
                            {n}/{participants.length}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: INK }}
                      >
                        {coveragePct}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Legend */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
            style={{ color: inkA(0.45) }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-green-50 ring-1 ring-green-200" />
              scored
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-amber-50 ring-1 ring-amber-300" />
              draft (not submitted)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-50 ring-1 ring-red-200" />
              missing
            </span>
            <span>Rows are seat (constituency) numbers — never names.</span>
          </div>
        </>
      )}
    </div>
  );
}
