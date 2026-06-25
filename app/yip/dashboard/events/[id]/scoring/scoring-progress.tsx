"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  lockScores,
  unlockScores,
  computeResults,
  submitDraftOnBehalf,
  submitAllDraftsForJury,
} from "@/app/yip/actions/results";
import { getAllScoresForExport } from "@/app/yip/actions/scoring-detail";
import type { ScoringProgressData } from "@/app/yip/actions/results";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
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
  Lock,
  Unlock,
  Calculator,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star,
  Users,
  ChevronRight,
  ChevronDown,
  Download,
  Search,
  Send,
} from "lucide-react";

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Renders a relative timestamp that is hydration-safe. The first server render
 * outputs a stable placeholder; the client effect swaps in the locale/now-based
 * string. This avoids React #418 (text content mismatch) caused by SSR (UTC)
 * vs client (local) differences in `new Date()` and locale formatting.
 */
function RelativeTime({ dateStr }: { dateStr: string | null }) {
  const [label, setLabel] = useState<string>(dateStr ? "—" : "Never");
  useEffect(() => {
    setLabel(formatRelative(dateStr));
  }, [dateStr]);
  return <span suppressHydrationWarning>{label}</span>;
}

const STATUS_STYLES = {
  green: "bg-green-100 text-green-700 border-green-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  red: "bg-red-100 text-red-700 border-red-200",
} as const;

const STATUS_DOTS = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
} as const;

export function ScoringProgress({
  eventId,
  data,
}: {
  eventId: string;
  data: ScoringProgressData;
}) {
  const router = useRouter();
  const [lockLoading, setLockLoading] = useState(false);
  const [computeLoading, setComputeLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  // Draft drill-down: which jury row is expanded, and which submit is in-flight
  // (scoreId for a single draft, or `jury:<id>` for a juror's "submit all").
  const [expandedJury, setExpandedJury] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);

  async function handleSubmitDraft(scoreId: string) {
    setDraftBusy(scoreId);
    setMessage(null);
    const res = await submitDraftOnBehalf(eventId, scoreId);
    if (res.success) {
      setMessage({
        type: "success",
        text: "Draft submitted — it now counts toward the final.",
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error });
    }
    setDraftBusy(null);
  }

  async function handleSubmitAllForJury(juryId: string) {
    setDraftBusy(`jury:${juryId}`);
    setMessage(null);
    const res = await submitAllDraftsForJury(eventId, juryId);
    if (res.success) {
      const { submitted, skipped } = res.data;
      setMessage({
        type: skipped > 0 ? "error" : "success",
        text:
          `Submitted ${submitted} draft${submitted === 1 ? "" : "s"}.` +
          (skipped > 0
            ? ` ${skipped} skipped — out of range, the juror must re-score.`
            : ""),
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error });
    }
    setDraftBusy(null);
  }

  const { event, totalParticipants, participantsScored, juryProgress, participantProgress } = data;
  const progressPercent =
    totalParticipants > 0
      ? Math.round((participantsScored / totalParticipants) * 100)
      : 0;

  // "Fully scored" = strict completeness from the data layer: all active juries
  // have scored this person in EVERY session they're in (not just "≥3 rows").
  const fullyScored = participantProgress.filter((p) => p.fullyScored).length;
  const fullyPercent =
    totalParticipants > 0
      ? Math.round((fullyScored / totalParticipants) * 100)
      : 0;

  // Scoring-list controls: search by name or seat (constituency) number, and a
  // "not scored yet" filter to surface anyone no juror has scored.
  const [query, setQuery] = useState("");
  const [onlyUnscored, setOnlyUnscored] = useState(false);
  const q = query.trim().toLowerCase();
  const filteredParticipants = participantProgress.filter((p) => {
    if (onlyUnscored && p.juriesScored > 0) return false;
    if (!q) return true;
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.constituency_number != null &&
        String(p.constituency_number).includes(q))
    );
  });
  const unscoredCount = participantProgress.filter(
    (p) => p.juriesScored === 0
  ).length;

  async function handleLockToggle() {
    setLockLoading(true);
    setMessage(null);
    const result = event.scores_locked
      ? await unlockScores(eventId)
      : await lockScores(eventId);

    if (result.success) {
      setMessage({
        type: "success",
        text: event.scores_locked
          ? "Scores unlocked. Jury can now edit."
          : "Scores locked. No further edits allowed.",
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setLockLoading(false);
  }

  async function handleCompute() {
    setComputeLoading(true);
    setMessage(null);
    const result = await computeResults(eventId);

    if (result.success) {
      setMessage({
        type: "success",
        text: `Results computed for ${result.data.computed} participants. View them in the Results tab.`,
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setComputeLoading(false);
  }

  async function handleExportAll() {
    setExporting(true);
    setMessage(null);
    try {
      const rows = await getAllScoresForExport(eventId);
      if (!rows) {
        setMessage({ type: "error", text: "You don't have access to export scores." });
        return;
      }
      if (rows.length === 0) {
        setMessage({ type: "error", text: "No scores have been submitted yet." });
        return;
      }
      // Union of every criterion key seen across all jurors/sessions → columns.
      const criteriaKeys = Array.from(
        new Set(rows.flatMap((r) => Object.keys(r.criteria_scores)))
      ).sort();
      const headers = [
        "Serial", "Name", "Constituency", "Bench", "Party #", "Role",
        "Day", "Session", "Juror", "Turn", "Total",
        ...criteriaKeys,
        "No-confidence", "Walkout", "Ruckus", "Suspension", "Comments", "Submitted",
      ];
      const csvRows = rows.map((r) => [
        r.serial_no ?? "", r.full_name, r.constituency_name ?? "", r.party_side ?? "",
        r.party_number ?? "", r.parliament_role ?? "", r.session_day ?? "",
        r.session_title ?? "", r.jury_name, r.occurrence ?? "", r.total_score,
        ...criteriaKeys.map((k) => r.criteria_scores[k] ?? ""),
        r.flags.no_confidence_brought ? "Y" : "", r.flags.walkout ? "Y" : "",
        r.flags.ruckus ? "Y" : "", r.flags.suspension ? "Y" : "",
        r.comments ?? "", r.submitted_at ?? "",
      ]);
      const csv = [headers, ...csvRows]
        .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yip-all-scores-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: "error", text: "Export failed. Please try again." });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Header with actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Scoring Progress
          </h2>
          <p className="text-sm text-gray-500">
            Track jury scoring and compute final results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export all scores
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLockToggle}
            disabled={lockLoading}
          >
            {lockLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : event.scores_locked ? (
              <Unlock className="size-4" />
            ) : (
              <Lock className="size-4" />
            )}
            {event.scores_locked ? "Unlock Scores" : "Lock Scores"}
          </Button>
          <Button
            size="sm"
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            onClick={handleCompute}
            disabled={computeLoading}
          >
            {computeLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Calculator className="size-4" />
            )}
            Compute Results
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {event.scores_locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <Lock className="size-4 shrink-0" />
          Scores are locked. Jury members cannot edit their scores.
        </div>
      )}

      {/* Progress Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">
              {participantsScored} of {totalParticipants} participants scored
            </span>
            <span className="font-semibold text-gray-900">
              {progressPercent}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FF9933] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Users className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalParticipants}</p>
              <p className="text-xs text-gray-500">Scoreable Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF9933]/10">
              <Star className="size-5 text-[#FF9933]" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {juryProgress.reduce((s, j) => s + j.entriesSubmitted, 0)}
              </p>
              <p className="text-xs text-gray-500">Total Scores Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Clock className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{juryProgress.length}</p>
              <p className="text-xs text-gray-500">Active Juries</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jury Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Jury Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {juryProgress.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jury Name</TableHead>
                    <TableHead className="text-center">Participants Scored</TableHead>
                    <TableHead className="text-right">Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {juryProgress.map((j) => {
                    const hasDrafts = j.drafts.length > 0;
                    const isOpen = expandedJury === j.id;
                    return (
                      <Fragment key={j.id}>
                        <TableRow
                          className={
                            hasDrafts ? "cursor-pointer hover:bg-amber-50/40" : ""
                          }
                          onClick={
                            hasDrafts
                              ? () => setExpandedJury(isOpen ? null : j.id)
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {hasDrafts &&
                                (isOpen ? (
                                  <ChevronDown className="size-4 text-amber-600" />
                                ) : (
                                  <ChevronRight className="size-4 text-amber-600" />
                                ))}
                              {j.jury_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className={
                                j.participantsScored >= totalParticipants
                                  ? "bg-green-100 text-green-700"
                                  : j.participantsScored > 0
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-500"
                              }
                            >
                              {j.participantsScored} / {totalParticipants}
                            </Badge>
                            <p className="mt-1 text-[11px] text-gray-400">
                              {j.entriesSubmitted} score
                              {j.entriesSubmitted === 1 ? "" : "s"} ·{" "}
                              {j.sessionsCovered} session
                              {j.sessionsCovered === 1 ? "" : "s"}
                            </p>
                            {j.draftsNotSubmitted > 0 && (
                              <p className="mt-1 text-xs font-medium text-amber-600 underline-offset-2 hover:underline">
                                {j.draftsNotSubmitted} draft
                                {j.draftsNotSubmitted === 1 ? "" : "s"} not
                                submitted — {isOpen ? "hide" : "click to review"}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm text-gray-500">
                            <RelativeTime dateStr={j.lastActivity} />
                          </TableCell>
                        </TableRow>

                        {isOpen && hasDrafts && (
                          <TableRow className="bg-amber-50/50 hover:bg-amber-50/50">
                            <TableCell colSpan={3} className="p-0">
                              <div className="space-y-2 px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-amber-800">
                                    Unsubmitted drafts for {j.jury_name}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={draftBusy !== null}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSubmitAllForJury(j.id);
                                    }}
                                    className="h-7 gap-1 text-xs"
                                  >
                                    {draftBusy === `jury:${j.id}` ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Send className="size-3" />
                                    )}
                                    Submit all {j.drafts.length}
                                  </Button>
                                </div>
                                <div className="divide-y rounded-md border border-amber-200 bg-white">
                                  {j.drafts.map((d) => (
                                    <div
                                      key={d.scoreId}
                                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-gray-900">
                                          {d.participantName}
                                          {d.constituencyNumber != null && (
                                            <span className="ml-1 text-xs tabular-nums text-gray-400">
                                              #{d.constituencyNumber}
                                            </span>
                                          )}
                                        </p>
                                        <p className="truncate text-xs text-gray-500">
                                          {d.sessionTitle ?? "Session"} · saved
                                          total {d.totalScore}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(
                                              `/yip/dashboard/events/${eventId}/scoring/${d.participantId}`
                                            );
                                          }}
                                        >
                                          View
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-7 gap-1 bg-[#FF9933] text-xs text-white hover:bg-[#E68A2E]"
                                          disabled={draftBusy !== null}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSubmitDraft(d.scoreId);
                                          }}
                                        >
                                          {draftBusy === d.scoreId ? (
                                            <Loader2 className="size-3 animate-spin" />
                                          ) : (
                                            <Send className="size-3" />
                                          )}
                                          Submit
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[11px] text-amber-700/80">
                                  Submitting counts the juror&apos;s saved score
                                  toward the final. Check the saved total looks
                                  complete first.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">
              No active jury members assigned to this event.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Participant Scoring Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Participant Scoring Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participantProgress.length > 0 ? (
            <>
              {/* Fully-scored progress — strict: all juries × every session. */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {fullyScored} of {totalParticipants} fully scored
                  </span>
                  <span className="text-gray-500">{fullyPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${fullyPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  &ldquo;Fully scored&rdquo; means all {data.juryProgress.length}{" "}
                  juries have scored that person in every session they&apos;ve
                  been scored in. A green dot below marks each one.
                </p>
              </div>

              {/* Search by name/seat number + "not scored yet" filter */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or seat number…"
                    className="pl-8"
                  />
                </div>
                <Button
                  type="button"
                  variant={onlyUnscored ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOnlyUnscored((v) => !v)}
                >
                  Not scored yet ({unscoredCount})
                </Button>
                {(q || onlyUnscored) && (
                  <span className="text-xs text-gray-500">
                    Showing {filteredParticipants.length} of{" "}
                    {participantProgress.length}
                  </span>
                )}
              </div>

              <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Constituency</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Juries Scored</TableHead>
                    <TableHead className="text-right">Avg So Far</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((p) => {
                    // Strict: green only when the whole jury×session grid is full;
                    // amber once any jury has scored; red when nobody has.
                    const color: "green" | "yellow" | "red" = p.fullyScored
                      ? "green"
                      : p.juriesScored > 0
                      ? "yellow"
                      : "red";
                    const side = p.party_side as "ruling" | "opposition" | null;
                    return (
                      <TableRow
                        key={p.id}
                        onClick={() =>
                          router.push(
                            `/yip/dashboard/events/${eventId}/scoring/${p.id}`
                          )
                        }
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {p.full_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {p.constituency_name ?? "—"}
                          {p.constituency_number != null && (
                            <span className="ml-1 text-xs text-gray-400 tabular-nums">
                              #{p.constituency_number}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {p.committee_number != null ? (
                            <>
                              <span className="tabular-nums">
                                #{p.committee_number}
                              </span>
                              {p.committee_name && (
                                <span className="ml-1 text-xs text-gray-400">
                                  {p.committee_name}
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.parliament_role && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {ROLE_LABELS[p.parliament_role] ??
                                  p.parliament_role}
                              </Badge>
                            )}
                            {(side || p.party_number != null) && (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${
                                  side
                                    ? PARTY_COLORS[side].badge
                                    : "bg-[#FF9933]/15 text-[#9a5212]"
                                }`}
                              >
                                {p.party_number != null
                                  ? `Party ${String.fromCharCode(
                                      64 + p.party_number
                                    )}`
                                  : side === "ruling"
                                    ? "Ruling"
                                    : "Opposition"}
                                {side && (
                                  <span className="ml-1 font-normal opacity-80">
                                    ·{" "}
                                    {side === "ruling" ? "Ruling" : "Opposition"}
                                  </span>
                                )}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLES[color]}
                          >
                            {p.juriesScored} / {p.totalJuries} juries
                          </Badge>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {p.sessionsScored} session
                            {p.sessionsScored === 1 ? "" : "s"} scored
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {p.avgScoreSoFar !== null
                            ? p.avgScoreSoFar.toFixed(1)
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className={`size-2.5 rounded-full ${STATUS_DOTS[color]}`}
                            />
                            <ChevronRight className="size-4 text-gray-300" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              {filteredParticipants.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500">
                  No participants match your search or filter.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">
              No participants with assigned roles yet. Run allocation first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
