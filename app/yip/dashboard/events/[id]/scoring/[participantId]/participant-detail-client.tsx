"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type {
  ParticipantScoringDetail,
  ParticipantScoreRow,
} from "@/app/yip/actions/scoring-detail";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  ArrowLeft,
  Trophy,
  MessageSquare,
  AlertTriangle,
  Star,
  Download,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";

const FLAG_LABELS: Record<keyof ParticipantScoreRow["flags"], string> = {
  no_confidence_brought: "No-Confidence Motion",
  walkout: "Walkout",
  ruckus: "Ruckus",
  suspension: "Suspension",
};

function SubmittedAt({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState<string>(iso ? "—" : "Not submitted");
  useEffect(() => {
    if (!iso) return;
    setLabel(
      new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    );
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}

export function ParticipantDetailClient({
  eventId,
  detail,
}: {
  eventId: string;
  detail: ParticipantScoringDetail;
}) {
  const { participant: p, scores, result } = detail;
  const side = p.party_side as "ruling" | "opposition" | null;

  // Group scores by session (Day + title); null sessions fall under "Overall".
  const groups = new Map<string, ParticipantScoreRow[]>();
  for (const s of scores) {
    const key =
      s.session_title != null
        ? `Day ${s.session_day} · ${s.session_title}`
        : "Overall (no session)";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }

  // Export this participant's jury scores as a CSV (client-side, no deps).
  function exportCsv() {
    const criteriaKeys = Array.from(
      new Set(scores.flatMap((s) => Object.keys(s.criteria_scores)))
    ).sort();
    const esc = (v: string | number | null) => {
      const str = v == null ? "" : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [
      "Juror",
      "Session",
      "Total",
      ...criteriaKeys,
      "Special Remarks",
      "Comments",
      "Status",
      "Submitted At",
    ];
    const lines = scores.map((s) => {
      const remarks = (Object.keys(s.flags) as (keyof typeof s.flags)[])
        .filter((k) => s.flags[k])
        .map((k) => FLAG_LABELS[k])
        .join("; ");
      const sessionLabel =
        s.session_title != null
          ? `Day ${s.session_day} - ${s.session_title}`
          : "Overall";
      return [
        s.jury_name,
        sessionLabel,
        s.total_score,
        ...criteriaKeys.map((k) => s.criteria_scores[k] ?? ""),
        remarks,
        s.comments ?? "",
        s.status ?? "",
        s.submitted_at ?? "",
      ]
        .map(esc)
        .join(",");
    });
    const csv = [header.map(esc).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.full_name.replace(/[^a-z0-9]+/gi, "_")}_scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/yip/dashboard/events/${eventId}/scoring`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          Back to Scoring
        </Link>
        {scores.length > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="size-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Participant header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{p.full_name}</h1>
              <p className="text-sm text-gray-500">{p.school_name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {p.parliament_role && (
                  <Badge variant="secondary" className="text-[11px]">
                    {ROLE_LABELS[p.parliament_role] ?? p.parliament_role}
                  </Badge>
                )}
                {side && (
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${PARTY_COLORS[side].badge}`}
                  >
                    {side === "ruling" ? "Ruling" : "Opposition"}
                  </Badge>
                )}
                {p.constituency_name && (
                  <span className="text-xs text-gray-500">
                    {p.constituency_name}
                  </span>
                )}
                {p.checked_in ? (
                  <Badge
                    variant="secondary"
                    className="text-[11px] bg-green-100 text-green-700"
                  >
                    <CheckCircle2 className="mr-1 size-3" />
                    Checked in
                    {p.checked_in_at && (
                      <span className="ml-1 font-normal opacity-80">
                        <SubmittedAt iso={p.checked_in_at} />
                      </span>
                    )}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[11px] bg-gray-100 text-gray-500"
                  >
                    <MinusCircle className="mr-1 size-3" />
                    Not checked in
                  </Badge>
                )}
              </div>
            </div>
            {p.serial_no != null && (
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-400">Participant</p>
                <p className="text-lg font-bold text-gray-700">#{p.serial_no}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Computed result (if results have been run) */}
      {result && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-[#FF9933]" />
              Computed Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">#{result.rank}</p>
                <p className="text-xs text-gray-500">Rank</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {result.avg_score.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">Final Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {result.jury_count}
                </p>
                <p className="text-xs text-gray-500">Jurors</p>
              </div>
            </div>
            {result.award_category && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <Star className="size-4 shrink-0" />
                {result.award_category}
              </div>
            )}
            {Object.keys(result.score_breakdown).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.score_breakdown).map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                  >
                    {k}: <span className="font-semibold">{v}</span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Per-juror scores, grouped by session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Jury Scores ({scores.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No jury scores recorded for this participant yet.
            </p>
          ) : (
            <div className="space-y-5">
              {Array.from(groups.entries()).map(([sessionLabel, rows]) => (
                <div key={sessionLabel}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {sessionLabel}
                  </p>
                  <div className="space-y-2">
                    {rows.map((s) => {
                      const activeFlags = (
                        Object.keys(s.flags) as (keyof typeof s.flags)[]
                      ).filter((k) => s.flags[k]);
                      return (
                        <div
                          key={s.id}
                          className="rounded-lg border border-gray-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm text-gray-900">
                              {s.jury_name}
                            </p>
                            <div className="flex items-center gap-2">
                              {s.status && (
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] ${
                                    s.status === "submitted"
                                      ? "bg-green-100 text-green-700"
                                      : s.status === "locked"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {s.status}
                                </Badge>
                              )}
                              <span className="font-mono text-sm font-bold text-gray-900">
                                {s.total_score}
                              </span>
                            </div>
                          </div>

                          {Object.keys(s.criteria_scores).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {Object.entries(s.criteria_scores).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                                >
                                  {k}: <span className="font-semibold">{v}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {activeFlags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {activeFlags.map((k) => (
                                <span
                                  key={k}
                                  className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700"
                                >
                                  <AlertTriangle className="size-3" />
                                  {FLAG_LABELS[k]}
                                </span>
                              ))}
                            </div>
                          )}

                          {s.comments && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600">
                              <MessageSquare className="mt-0.5 size-3 shrink-0" />
                              <span>{s.comments}</span>
                            </div>
                          )}

                          <p className="mt-1.5 text-[11px] text-gray-400">
                            <SubmittedAt iso={s.submitted_at} />
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
