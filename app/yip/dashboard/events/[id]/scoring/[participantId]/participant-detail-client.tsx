"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateScoreAsOrganizer,
  type ParticipantScoringDetail,
  type ParticipantScoreRow,
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
  Pencil,
  Save,
  X,
  Loader2,
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
  canEdit,
}: {
  eventId: string;
  detail: ParticipantScoringDetail;
  canEdit: boolean;
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
  // Auditable layout: EVERY individual turn (occurrence) is its own row, then a
  // second block shows the averages — each juror's mean across their turns, and
  // the SESSION average computed two-level (mean of per-juror means), exactly as
  // the results engine does. This makes Question Hour (multiple turns per juror)
  // fully traceable: all turns AND the average that feeds the score.
  function exportCsv() {
    const criteriaKeys = Array.from(
      new Set(scores.flatMap((s) => Object.keys(s.criteria_scores)))
    ).sort();
    const esc = (v: string | number | null) => {
      const str = v == null ? "" : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sessionLabelOf = (s: ParticipantScoreRow) =>
      s.session_title != null
        ? `Day ${s.session_day} - ${s.session_title}`
        : "Overall";
    const header = [
      "Juror",
      "Turn",
      "Session",
      "Total",
      ...criteriaKeys,
      "Special Remarks",
      "Comments",
      "Status",
      "Submitted At",
    ];
    const blank = criteriaKeys.map(() => "");
    // Block 1 — every individual turn.
    const turnLines = scores.map((s) => {
      const remarks = (Object.keys(s.flags) as (keyof typeof s.flags)[])
        .filter((k) => s.flags[k])
        .map((k) => FLAG_LABELS[k])
        .join("; ");
      return [
        s.jury_name,
        `Turn ${s.occurrence}`,
        sessionLabelOf(s),
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
    // Block 2 — two-level averages (per-juror mean → mean across jurors),
    // grouped by agenda_item_id exactly like the results engine. The Day+title
    // is only a display label (two distinct items could share one), so the
    // grouping key must be the item id, never the label.
    const bySession = new Map<
      string,
      { label: string; jurors: Map<string, { name: string; total: number }[]> }
    >();
    for (const s of scores) {
      const key = s.agenda_item_id ?? sessionLabelOf(s);
      let grp = bySession.get(key);
      if (!grp) {
        grp = { label: sessionLabelOf(s), jurors: new Map() };
        bySession.set(key, grp);
      }
      const arr = grp.jurors.get(s.jury_assignment_id) ?? [];
      arr.push({ name: s.jury_name, total: s.total_score });
      grp.jurors.set(s.jury_assignment_id, arr);
    }
    const avgLines: string[] = [];
    for (const [, grp] of bySession) {
      const sk = grp.label;
      const jurorMap = grp.jurors;
      const perJurorMeans: number[] = [];
      for (const [, turns] of jurorMap) {
        const mean = turns.reduce((a, b) => a + b.total, 0) / turns.length;
        perJurorMeans.push(mean);
        if (turns.length > 1) {
          avgLines.push(
            [
              turns[0].name,
              `avg of ${turns.length} turns`,
              sk,
              round2(mean),
              ...blank,
              "",
              "",
              "average",
              "",
            ]
              .map(esc)
              .join(",")
          );
        }
      }
      const sessionAvg =
        perJurorMeans.reduce((a, b) => a + b, 0) / perJurorMeans.length;
      avgLines.push(
        [
          "— SESSION AVERAGE —",
          "(mean of jurors)",
          sk,
          round2(sessionAvg),
          ...blank,
          "",
          "",
          "average",
          "",
        ]
          .map(esc)
          .join(",")
      );
    }
    const csv = [
      header.map(esc).join(","),
      ...turnLines,
      "",
      esc(
        "AVERAGES — two-level mean of submitted juror totals (each juror's turns averaged first, then the mean across jurors). Note: Committee and Bill sessions are rolled up from a shared committee score in the final results engine, so for those sessions the average shown here is the raw juror total, not the final session figure."
      ),
      ...avgLines,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.full_name.replace(/[^a-z0-9]+/gi, "_")}_scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Chair-only score correction (audited).
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [editComments, setEditComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  function startEdit(s: ParticipantScoreRow) {
    setEditErr(null);
    setEditingId(s.id);
    setEditVals(
      Object.fromEntries(
        Object.entries(s.criteria_scores).map(([k, v]) => [k, String(v)])
      )
    );
    setEditComments(s.comments ?? "");
  }
  function cancelEdit() {
    setEditingId(null);
    setEditErr(null);
  }
  const editTotal = Object.values(editVals).reduce((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
  }, 0);
  async function saveEdit(scoreId: string) {
    setSaving(true);
    setEditErr(null);
    const criteria: Record<string, number> = {};
    for (const [k, v] of Object.entries(editVals)) {
      const n = Number(v);
      criteria[k] = Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    const res = await updateScoreAsOrganizer(
      eventId,
      scoreId,
      criteria,
      editComments
    );
    setSaving(false);
    if (!res.success) {
      setEditErr(res.error);
      return;
    }
    setEditingId(null);
    router.refresh();
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
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {p.parliament_role && (
                  <Badge variant="secondary" className="text-[11px]">
                    {ROLE_LABELS[p.parliament_role] ?? p.parliament_role}
                  </Badge>
                )}
                {(side || p.party_number != null) && (
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${
                      side
                        ? PARTY_COLORS[side].badge
                        : "bg-[#FF9933]/15 text-[#9a5212]"
                    }`}
                  >
                    {p.party_number != null
                      ? `Party ${String.fromCharCode(64 + p.party_number)}`
                      : side === "ruling"
                        ? "Ruling"
                        : "Opposition"}
                    {side && (
                      <span className="ml-1 font-normal opacity-80">
                        · {side === "ruling" ? "Ruling" : "Opposition"}
                      </span>
                    )}
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
            {p.constituency_number != null && (
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-400">Participant</p>
                <p className="text-lg font-bold text-gray-700">
                  #{p.constituency_number}
                </p>
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
                              {canEdit && editingId !== s.id && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(s)}
                                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                  title="Correct this score (chair only — audited)"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {editingId === s.id ? (
                            <div className="mt-2 space-y-2 rounded-md border border-blue-200 bg-blue-50/50 p-2.5">
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {Object.keys(editVals).map((k) => (
                                  <label
                                    key={k}
                                    className="text-[11px] text-gray-600"
                                  >
                                    {k}
                                    <input
                                      type="number"
                                      min={0}
                                      value={editVals[k]}
                                      onChange={(e) =>
                                        setEditVals((prev) => ({
                                          ...prev,
                                          [k]: e.target.value,
                                        }))
                                      }
                                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                    />
                                  </label>
                                ))}
                              </div>
                              <textarea
                                value={editComments}
                                onChange={(e) => setEditComments(e.target.value)}
                                placeholder="Comments (optional)"
                                rows={2}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-600">
                                  New total:{" "}
                                  <span className="font-bold">{editTotal}</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={saving}
                                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                  >
                                    <X className="size-3" /> Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(s.id)}
                                    disabled={saving}
                                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {saving ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Save className="size-3" />
                                    )}
                                    Save correction
                                  </button>
                                </div>
                              </div>
                              {editErr && (
                                <p className="text-xs text-red-600">{editErr}</p>
                              )}
                              <p className="text-[10px] text-gray-500">
                                Logged as an organizer correction. Re-run “Compute
                                Results” afterwards to update standings.
                              </p>
                            </div>
                          ) : (
                            Object.keys(s.criteria_scores).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {Object.entries(s.criteria_scores).map(
                                  ([k, v]) => (
                                    <span
                                      key={k}
                                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                                    >
                                      {k}:{" "}
                                      <span className="font-semibold">{v}</span>
                                    </span>
                                  )
                                )}
                              </div>
                            )
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

                          {editingId !== s.id && s.comments && (
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
