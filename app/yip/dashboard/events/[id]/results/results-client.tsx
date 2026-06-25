"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { publishResults, unpublishResults } from "@/app/yip/actions/results";
import type {
  ResultWithParticipant,
  AwardCandidateGroup,
} from "@/app/yip/actions/results";
import {
  setAwardWinner,
  clearAwardOverride,
} from "@/app/yip/actions/award-overrides";
import type { AwardOverride } from "@/app/yip/actions/award-overrides";
import { AWARD_LABELS } from "@/lib/yip/awards";
import { getEventQualificationData } from "@/app/yip/actions/pipeline";
import { QualificationPanel } from "./qualification-panel";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { StudentScoreSheet } from "./student-score-sheet";
import { LeadershipTracker } from "./leadership-tracker";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Trophy,
  Eye,
  EyeOff,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Award,
  Crown,
  Star,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users,
  Heart,
  Gavel,
  MapPin,
  TrendingUp,
  Pencil,
  X,
} from "lucide-react";

// ─── Award card styling ───────────────────────────────────────────
// The engine decides which awards exist and emits their labels in
// `award_category` (a comma-joined string). The UI must render whatever
// labels are present — never assume a fixed list or count. This map only
// supplies presentation (icon + colors) per known label; any label not
// found here falls back to a neutral style, so new/renamed awards still
// render correctly.

type AwardStyle = {
  icon: typeof Award;
  bg: string;
  border: string;
  iconColor: string;
};

const AWARD_STYLES: Record<string, AwardStyle> = {
  "Best Parliamentarian": {
    icon: Crown,
    bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
    border: "border-amber-200",
    iconColor: "text-amber-600",
  },
  "Best Debater": {
    icon: MessageSquare,
    bg: "bg-gradient-to-br from-fuchsia-50 to-pink-50",
    border: "border-fuchsia-200",
    iconColor: "text-fuchsia-600",
  },
  "Best Research & Presentation": {
    icon: BookOpen,
    bg: "bg-gradient-to-br from-indigo-50 to-blue-50",
    border: "border-indigo-200",
    iconColor: "text-indigo-600",
  },
  "Most Valuable Participant (MVP)": {
    icon: TrendingUp,
    bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-600",
  },
  "Best Constituency Representative": {
    icon: MapPin,
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
    border: "border-orange-200",
    iconColor: "text-orange-700",
  },
  "Exemplary Parliamentary Decorum": {
    icon: Gavel,
    bg: "bg-gradient-to-br from-violet-50 to-purple-50",
    border: "border-violet-200",
    iconColor: "text-violet-600",
  },
  "Team Spirit": {
    icon: Users,
    bg: "bg-gradient-to-br from-cyan-50 to-blue-50",
    border: "border-cyan-200",
    iconColor: "text-cyan-600",
  },
  "Innovative Ideas": {
    icon: Lightbulb,
    bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
    border: "border-yellow-200",
    iconColor: "text-yellow-600",
  },
  "Community Impact": {
    icon: Heart,
    bg: "bg-gradient-to-br from-rose-50 to-pink-50",
    border: "border-rose-200",
    iconColor: "text-rose-600",
  },
};

const DEFAULT_AWARD_STYLE: AwardStyle = {
  icon: Star,
  bg: "bg-gradient-to-br from-slate-50 to-gray-50",
  border: "border-gray-200",
  iconColor: "text-gray-600",
};

function getAwardStyle(label: string): AwardStyle {
  return AWARD_STYLES[label] ?? DEFAULT_AWARD_STYLE;
}


// ─── CSV Export ──────────────────────────────────────────────────

function exportCSV(results: ResultWithParticipant[], eventName: string) {
  // Yi 2026 official leaderboard format. Constituency No is the per-participant
  // identifier (each constituency number maps to one delegate), so no separate
  // Participant ID column. School/Class are not collected, so they're omitted.
  const headers = [
    "Rank",
    "Student Name",
    "Constituency No",
    "Constituency",
    "Party",
    "Committee",
    "Total Score",
    "Remarks",
  ];

  const rows = results.map((r) => [
    r.rank ?? "",
    r.participant.full_name,
    r.participant.constituency_number ?? "",
    r.participant.constituency_name ?? "",
    r.participant.party_number != null
      ? String.fromCharCode(64 + r.participant.party_number)
      : r.participant.party_side ?? "",
    r.participant.committee_name ?? r.participant.committee_number ?? "",
    r.avg_score ?? "",
    r.award_category ?? "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escape commas and quotes
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${eventName.replace(/[^a-zA-Z0-9]/g, "_")}_results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Component ──────────────────────────────────────────────────

export function ResultsClient({
  eventId,
  eventName,
  resultsPublishedAt,
  results,
  awardOverrides = [],
  canOverrideAwards = false,
  eventLevel = "chapter",
  initialQualifiedIds = [],
  positionBonuses = {},
  day2CheckinWarning = false,
  awardCandidates = [],
  zoneAwardConfig = {},
  canQualify = false,
}: {
  eventId: string;
  eventName: string;
  resultsPublishedAt: string | null;
  results: ResultWithParticipant[];
  awardOverrides?: AwardOverride[];
  canOverrideAwards?: boolean;
  eventLevel?: string;
  initialQualifiedIds?: string[];
  positionBonuses?: Record<string, number>;
  // Award-based qualification (locked 2026-06-25). Per-zone config of which
  // awards confer advancement (award_key -> qualifies; absence = true), plus
  // whether the current viewer may lock qualifiers (super-admin only).
  zoneAwardConfig?: Record<string, boolean>;
  canQualify?: boolean;
  // Two-day event with ZERO Day-2 check-ins: computing now marks everyone
  // "Not ranked — absent Day 2". Surface a warning so the chair doesn't publish
  // an all-unranked leaderboard before Day-2 check-in is done.
  day2CheckinWarning?: boolean;
  // Top-5 contender shortlist per award (pre-cap), with the actual winner(s)
  // flagged (post-cap). Empty until results are computed.
  awardCandidates?: AwardCandidateGroup[];
}) {
  const router = useRouter();

  // Leaderboard (ranked) vs Student Score Sheet (all students × buckets) view.
  const [resultsView, setResultsView] = useState<
    "leaderboard" | "scoresheet" | "leadership"
  >("leaderboard");

  // Manual award override (chair's final say)
  const [overrideAward, setOverrideAward] = useState<string>("");
  const [overrideParticipant, setOverrideParticipant] = useState<string>("");
  const [overrideNote, setOverrideNote] = useState<string>("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  async function handleSetOverride() {
    if (!overrideAward || !overrideParticipant) {
      setMessage({ type: "error", text: "Pick both an award and a participant." });
      return;
    }
    setOverrideLoading(true);
    const res = await setAwardWinner(
      eventId,
      overrideAward,
      overrideParticipant,
      overrideNote
    );
    setOverrideLoading(false);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setOverrideAward("");
    setOverrideParticipant("");
    setOverrideNote("");
    setMessage({ type: "success", text: "Award winner overridden and results recomputed." });
    router.refresh();
  }

  async function handleClearOverride(awardLabel: string) {
    setOverrideLoading(true);
    const res = await clearAwardOverride(eventId, awardLabel);
    setOverrideLoading(false);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({ type: "success", text: "Override cleared — the computed winner is restored." });
    router.refresh();
  }
  const [publishLoading, setPublishLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Qualifier state. qualifiedIds drives the leaderboard "Qualified" badge and is
  // kept in sync by the award-based QualificationPanel below (onQualifiedChange).
  const [qualifiedIds, setQualifiedIds] = useState<Set<string>>(
    new Set(initialQualifiedIds)
  );
  const [resolvedLevel, setResolvedLevel] = useState(eventLevel);

  // Fetch real event level + qualified IDs on mount
  useEffect(() => {
    getEventQualificationData(eventId).then((data) => {
      setResolvedLevel(data.level);
      if (data.qualifiedIds.length > 0) {
        setQualifiedIds(new Set(data.qualifiedIds));
      }
    });
  }, [eventId]);

  const isPublished = !!resultsPublishedAt;
  const showQualifiers = resolvedLevel === "chapter" || resolvedLevel === "regional";
  const nextLevelLabel = resolvedLevel === "chapter" ? "Regional" : "National";

  // Qualification (award-based) is handled by <QualificationPanel/> below, which
  // reuses the shared markQualified/unmarkQualified primitives. It calls back via
  // onQualifiedChange to keep qualifiedIds (the leaderboard badge) in sync.

  async function handlePublishToggle() {
    setPublishLoading(true);
    setMessage(null);
    const result = isPublished
      ? await unpublishResults(eventId)
      : await publishResults(eventId);

    if (result.success) {
      setMessage({
        type: "success",
        text: isPublished
          ? "Results unpublished. Participants can no longer see them."
          : "Results published! Participants can now view their scores.",
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setPublishLoading(false);
  }

  // A day-incomplete participant (attended only one day of a two-day event) is
  // "not ranked" — the engine writes the reason into award_category prefixed
  // "Not ranked —". It is NOT an award: detect it here so it never renders as an
  // award card/badge, and surface it as a distinct status instead.
  const NOT_RANKED_PREFIX = "Not ranked";
  const notRankedReason = (r: ResultWithParticipant): string | null =>
    r.rank == null && r.award_category?.startsWith(NOT_RANKED_PREFIX)
      ? r.award_category
      : null;

  // Build award winners map from whatever labels the engine emitted.
  const awardWinners = new Map<string, ResultWithParticipant[]>();
  for (const r of results) {
    if (r.award_category && !notRankedReason(r)) {
      const categories = r.award_category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      for (const cat of categories) {
        const existing = awardWinners.get(cat) ?? [];
        existing.push(r);
        awardWinners.set(cat, existing);
      }
    }
  }

  // Order: known awards first (in the order declared in AWARD_STYLES),
  // then any unrecognized labels alphabetically. Only labels actually
  // present in the data are rendered.
  const styleOrder = Object.keys(AWARD_STYLES);
  const awardLabels = Array.from(awardWinners.keys()).sort((a, b) => {
    const ai = styleOrder.indexOf(a);
    const bi = styleOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  // Interim-recompute guardrail: two-day event with zero Day-2 check-ins ⇒
  // computing now marks everyone "Not ranked — absent Day 2". Shown in both the
  // empty state and the leaderboard so the chair is warned before publishing.
  const day2Banner = day2CheckinWarning ? (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">Day-2 check-in hasn&apos;t started</p>
        <p className="mt-0.5">
          This is a two-day event and no students are checked in for Day&nbsp;2
          yet. Computing results now will mark <strong>every student</strong> as
          &quot;Not ranked — absent Day&nbsp;2&quot;. Complete Day-2 check-in
          before computing or publishing final results.
        </p>
      </div>
    </div>
  ) : null;

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        {day2Banner}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
          <Trophy className="mb-4 size-12 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">
            No Results Yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Go to the Scoring tab and click &quot;Compute Results&quot; after
            jury members have submitted their scores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {day2Banner}
      {/* Message banner */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Publish status banner */}
      <div
        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
          isPublished
            ? "border-green-200 bg-green-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          {isPublished ? (
            <>
              <Eye className="size-4 text-green-600" />
              <span className="font-medium text-green-700">
                Results are published
              </span>
              <span className="text-green-600">
                &mdash; participants can see their scores
              </span>
            </>
          ) : (
            <>
              <EyeOff className="size-4 text-gray-500" />
              <span className="font-medium text-gray-700">
                Results are not published
              </span>
              <span className="text-gray-500">
                &mdash; only you can see them
              </span>
            </>
          )}
        </div>
      </div>

      {/* Header with actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Results &amp; Awards
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(results, eventName)}
          >
            <Download className="size-4" />
            Leaderboard CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const mod = await import("@/app/yip/actions/post-session-report");
              const res = await mod.generatePostSessionReport(eventId);
              if (!res.success) {
                alert(res.error);
                return;
              }
              const blob = new Blob([res.data.csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = res.data.filename;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="border-[#138808]/30 text-[#138808] hover:bg-[#138808]/5"
          >
            <Download className="size-4" />
            National Report
          </Button>
          <Button
            size="sm"
            className={
              isPublished
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            }
            onClick={handlePublishToggle}
            disabled={publishLoading}
          >
            {publishLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPublished ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {isPublished ? "Unpublish" : "Publish Results"}
          </Button>
        </div>
      </div>

      {/* Award Cards — driven entirely by the labels present in the data */}
      {awardLabels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {awardLabels.map((label) => {
            const winners = awardWinners.get(label) ?? [];
            const style = getAwardStyle(label);
            const Icon = style.icon;
            return (
              <Card key={label} className={`${style.bg} border ${style.border}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Icon className={`size-8 shrink-0 ${style.iconColor}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {label}
                      </p>
                      {winners.map((w) => (
                        <div key={w.participant_id} className="mt-1">
                          <p className="text-base font-bold text-gray-900 truncate">
                            {w.participant.full_name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {w.participant.school_name}
                          </p>
                          <p className="mt-1 text-lg font-bold text-gray-900">
                            {w.avg_score?.toFixed(1)}
                            <span className="text-xs font-normal text-gray-500">
                              {" "}
                              pts
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Top-5 contenders per award — the shortlist BEFORE the one-award-per-
          student cap, with the actual winner(s) (AFTER the cap) highlighted. Lets
          reviewers see who was in contention and where each award landed once a
          higher-priority award claimed a stronger student. */}
      {awardCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="size-4 text-[#FF9933]" />
              Award contenders — top 5 per award
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-gray-500">
              Each student wins at most one award. These are the top-ranked
              contenders for each award; the highlighted row is who actually
              received it after the one-award cap.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {awardCandidates.map((group) => {
                const style = getAwardStyle(group.award_label);
                const Icon = style.icon;
                return (
                  <div
                    key={group.award_key}
                    className={`rounded-lg border ${style.border} ${style.bg} p-4`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className={`size-4 shrink-0 ${style.iconColor}`} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {group.award_label}
                      </p>
                    </div>
                    <ol className="space-y-1">
                      {group.candidates.map((c) => (
                        <li
                          key={`${group.award_key}-${c.participant_id}`}
                          className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
                            c.is_winner
                              ? "bg-white/80 font-semibold text-gray-900 ring-1 ring-[#FF9933]/40"
                              : "text-gray-700"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {c.is_winner ? (
                              <Crown className="size-3.5 shrink-0 text-[#FF9933]" />
                            ) : (
                              <span className="w-3.5 shrink-0 text-center text-xs text-gray-400">
                                {c.rank}
                              </span>
                            )}
                            <span className="truncate">
                              {c.participant_name ?? "—"}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-xs text-gray-500">
                            {c.score.toFixed(1)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual award override — chair's final say (chapter chair or higher) */}
      {canOverrideAwards && (
        <Card className="border-[#FF9933]/30 bg-[#FF9933]/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="size-4 text-[#FF9933]" />
              Override Award Winner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Pin the winner for any award. This overrides the auto-computed
              result and survives every recompute. Clear it to restore the
              computed winner.
            </p>

            {awardOverrides.length > 0 && (
              <div className="space-y-2">
                {awardOverrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ov.award_label} →{" "}
                        {ov.participant_name ?? "Unknown participant"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Overridden{ov.set_by_email ? ` by ${ov.set_by_email}` : ""}
                        {ov.note ? ` · ${ov.note}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={overrideLoading}
                      onClick={() => handleClearOverride(ov.award_label)}
                      className="shrink-0 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <X className="size-4" />
                      Clear
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label className="text-xs font-medium text-gray-500">Award</label>
                <select
                  value={overrideAward}
                  onChange={(e) => setOverrideAward(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select an award…</option>
                  {AWARD_LABELS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Winner
                </label>
                <select
                  value={overrideParticipant}
                  onChange={(e) => setOverrideParticipant(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select a participant…</option>
                  {results.map((r) => (
                    <option key={r.participant_id} value={r.participant_id}>
                      {r.participant.full_name} — {r.participant.school_name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={overrideLoading}
                onClick={handleSetOverride}
                className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
              >
                {overrideLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                Set Winner
              </Button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                Note (optional)
              </label>
              <input
                type="text"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Reason for the override (recorded in the audit log)"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard / Student Score Sheet */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              {resultsView === "scoresheet"
                ? "Student Score Sheet"
                : resultsView === "leadership"
                  ? "Leadership Tracker"
                  : "Leaderboard"}
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              <Button
                variant={resultsView === "leaderboard" ? "default" : "outline"}
                size="sm"
                onClick={() => setResultsView("leaderboard")}
              >
                Leaderboard
              </Button>
              <Button
                variant={resultsView === "scoresheet" ? "default" : "outline"}
                size="sm"
                onClick={() => setResultsView("scoresheet")}
              >
                Score Sheet
              </Button>
              <Button
                variant={resultsView === "leadership" ? "default" : "outline"}
                size="sm"
                onClick={() => setResultsView("leadership")}
              >
                Leadership
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {resultsView === "scoresheet" ? (
            <StudentScoreSheet
              results={results}
              positionBonuses={positionBonuses}
              eventName={eventName}
            />
          ) : resultsView === "leadership" ? (
            <LeadershipTracker
              results={results}
              positionBonuses={positionBonuses}
              eventName={eventName}
            />
          ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-center">Juries</TableHead>
                  <TableHead>Award</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const side = r.participant.party_side as
                    | "ruling"
                    | "opposition"
                    | null;
                  const reason = notRankedReason(r);
                  return (
                    <TableRow
                      key={r.id}
                      className={reason ? "bg-red-50/40" : undefined}
                    >
                      <TableCell className="text-center font-bold text-gray-700">
                        {r.rank ?? (
                          <span
                            className="text-gray-400"
                            title={reason ?? "Not ranked"}
                          >
                            &mdash;
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">
                            {r.participant.full_name}
                          </p>
                          {qualifiedIds.has(r.participant_id) && (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700 text-[9px] px-1 py-0"
                            >
                              Qualified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {r.participant.school_name}
                      </TableCell>
                      <TableCell>
                        {r.participant.parliament_role && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {ROLE_LABELS[r.participant.parliament_role] ??
                              r.participant.parliament_role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {(side || r.participant.party_number != null) && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${
                              side
                                ? PARTY_COLORS[side].badge
                                : "bg-[#FF9933]/15 text-[#9a5212]"
                            }`}
                          >
                            {r.participant.party_number != null
                              ? `Party ${String.fromCharCode(
                                  64 + r.participant.party_number
                                )}`
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
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {r.avg_score?.toFixed(1) ?? "--"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-gray-600">
                        {r.jury_count}
                      </TableCell>
                      <TableCell>
                        {reason ? (
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0"
                          >
                            {reason}
                          </Badge>
                        ) : (
                          r.award_category && (
                            <div className="flex flex-wrap gap-1">
                              {r.award_category
                                .split(",")
                                .map((a) => a.trim())
                                .filter(Boolean)
                                .map((a) => (
                                  <Badge
                                    key={a}
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                                  >
                                    {a}
                                  </Badge>
                                ))}
                            </div>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Award-based qualification (locked 2026-06-25) — only for
          chapter/regional events. Replaces the old rank-based "select N"
          qualifier: each qualifying award's chosen advancer moves up. */}
      {showQualifiers && results.length > 0 && (
        <QualificationPanel
          // Remount when the shortlist changes (e.g. after a recompute) so the
          // pre-ticked advancers reflect the latest winners, not a stale mount.
          key={awardCandidates
            .map((g) => `${g.award_key}:${g.candidates.find((c) => c.is_winner)?.participant_id ?? g.candidates[0]?.participant_id ?? ""}`)
            .join("|")}
          eventId={eventId}
          nextLevelLabel={nextLevelLabel}
          awardCandidates={awardCandidates}
          zoneAwardConfig={zoneAwardConfig}
          qualifiedIds={qualifiedIds}
          onQualifiedChange={(ids) => setQualifiedIds(new Set(ids))}
          canQualify={canQualify}
        />
      )}
    </div>
  );
}
