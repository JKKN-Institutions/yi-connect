"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { publishResults, unpublishResults } from "@/app/yip/actions/results";
import type { ResultWithParticipant } from "@/app/yip/actions/results";
import {
  markQualified,
  unmarkQualified,
  getEventQualificationData,
} from "@/app/yip/actions/pipeline";
import { ROLE_LABELS, PARTY_COLORS, MINISTRIES } from "@/lib/yip/constants";
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
  Shield,
  Swords,
  ArrowUpRight,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users,
  Heart,
  Sparkles,
  Gavel,
  Mic,
  MapPin,
  TrendingUp,
} from "lucide-react";

// ─── Award card config — 15 awards from YIP 2026 Handbook page 21 ─────────

const AWARD_CARDS = [
  {
    key: "Best Parliamentarian",
    label: "Best Parliamentarian",
    icon: Crown,
    gradient: "from-amber-500 to-yellow-400",
    bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
    border: "border-amber-200",
    iconColor: "text-amber-600",
  },
  {
    key: "Best Speaker",
    label: "Best Speaker",
    icon: Gavel,
    gradient: "from-purple-500 to-indigo-500",
    bg: "bg-gradient-to-br from-purple-50 to-indigo-50",
    border: "border-purple-200",
    iconColor: "text-purple-600",
  },
  {
    key: "Leadership Excellence",
    label: "Leadership Excellence",
    icon: Star,
    gradient: "from-orange-500 to-amber-400",
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
    border: "border-orange-200",
    iconColor: "text-orange-600",
  },
  {
    key: "Best Member — Ruling Bench",
    label: "Best Member — Ruling Bench",
    icon: Shield,
    gradient: "from-blue-600 to-blue-400",
    bg: "bg-gradient-to-br from-blue-50 to-sky-50",
    border: "border-blue-200",
    iconColor: "text-blue-700",
  },
  {
    key: "Best Member — Opposition Bench",
    label: "Best Member — Opposition Bench",
    icon: Swords,
    gradient: "from-red-500 to-rose-500",
    bg: "bg-gradient-to-br from-red-50 to-rose-50",
    border: "border-red-200",
    iconColor: "text-red-600",
  },
  {
    key: "Best Debater",
    label: "Best Debater",
    icon: MessageSquare,
    gradient: "from-fuchsia-500 to-pink-500",
    bg: "bg-gradient-to-br from-fuchsia-50 to-pink-50",
    border: "border-fuchsia-200",
    iconColor: "text-fuchsia-600",
  },
  {
    key: "Most Persuasive Policy Advocate",
    label: "Most Persuasive Policy Advocate",
    icon: Mic,
    gradient: "from-teal-500 to-cyan-500",
    bg: "bg-gradient-to-br from-teal-50 to-cyan-50",
    border: "border-teal-200",
    iconColor: "text-teal-600",
  },
  {
    key: "Best Research & Presentation",
    label: "Best Research & Presentation",
    icon: BookOpen,
    gradient: "from-indigo-500 to-blue-500",
    bg: "bg-gradient-to-br from-indigo-50 to-blue-50",
    border: "border-indigo-200",
    iconColor: "text-indigo-600",
  },
  {
    key: "Innovative Ideas",
    label: "Innovative Ideas",
    icon: Lightbulb,
    gradient: "from-yellow-500 to-amber-400",
    bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
    border: "border-yellow-200",
    iconColor: "text-yellow-600",
  },
  {
    key: "Community Impact",
    label: "Community Impact",
    icon: Heart,
    gradient: "from-rose-500 to-pink-500",
    bg: "bg-gradient-to-br from-rose-50 to-pink-50",
    border: "border-rose-200",
    iconColor: "text-rose-600",
  },
  {
    key: "Most Valuable Participant (MVP)",
    label: "MVP",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-teal-500",
    bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-600",
  },
  {
    key: "Team Spirit",
    label: "Team Spirit",
    icon: Users,
    gradient: "from-cyan-500 to-blue-500",
    bg: "bg-gradient-to-br from-cyan-50 to-blue-50",
    border: "border-cyan-200",
    iconColor: "text-cyan-600",
  },
  {
    key: "Exemplary Parliamentary Decorum",
    label: "Exemplary Parliamentary Decorum",
    icon: Award,
    gradient: "from-violet-500 to-purple-500",
    bg: "bg-gradient-to-br from-violet-50 to-purple-50",
    border: "border-violet-200",
    iconColor: "text-violet-600",
  },
  {
    key: "Independent Voice of the House",
    label: "Independent Voice",
    icon: Sparkles,
    gradient: "from-emerald-600 to-green-500",
    bg: "bg-gradient-to-br from-emerald-50 to-green-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-700",
  },
  {
    key: "Best Constituency Representative",
    label: "Best Constituency Representative",
    icon: MapPin,
    gradient: "from-saffron-500 to-orange-400",
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
    border: "border-orange-200",
    iconColor: "text-orange-700",
  },
] as const;

function getMinistryLabel(key: string | null): string {
  if (!key) return "";
  const found = MINISTRIES.find((m) => m.key === key);
  return found ? found.label : key;
}

// ─── CSV Export ──────────────────────────────────────────────────

function exportCSV(results: ResultWithParticipant[], eventName: string) {
  const headers = [
    "Rank",
    "Name",
    "School",
    "Class",
    "Party",
    "Role",
    "Ministry",
    "Constituency",
    "Committee",
    "Avg Score",
    "Jury Count",
    "Award",
  ];

  const rows = results.map((r) => [
    r.rank ?? "",
    r.participant.full_name,
    r.participant.school_name,
    r.participant.class,
    r.participant.party_side ?? "",
    r.participant.parliament_role
      ? ROLE_LABELS[r.participant.parliament_role] ?? r.participant.parliament_role
      : "",
    getMinistryLabel(r.participant.ministry),
    r.participant.constituency_name ?? "",
    r.participant.committee_name ?? "",
    r.avg_score ?? "",
    r.jury_count ?? "",
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
  eventLevel = "chapter",
  initialQualifiedIds = [],
}: {
  eventId: string;
  eventName: string;
  resultsPublishedAt: string | null;
  results: ResultWithParticipant[];
  eventLevel?: string;
  initialQualifiedIds?: string[];
}) {
  const router = useRouter();
  const [publishLoading, setPublishLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Qualifier state
  const [qualifiedIds, setQualifiedIds] = useState<Set<string>>(
    new Set(initialQualifiedIds)
  );
  const [selectedForQualify, setSelectedForQualify] = useState<Set<string>>(
    new Set()
  );
  const [qualifyLoading, setQualifyLoading] = useState(false);
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

  // Toggle selection for qualification
  function toggleQualifySelection(participantId: string) {
    setSelectedForQualify((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  }

  // Select all non-qualified for qualification
  function selectAllUnqualified() {
    const unqualified = results
      .filter((r) => !qualifiedIds.has(r.participant_id))
      .map((r) => r.participant_id);
    setSelectedForQualify(new Set(unqualified));
  }

  // Clear selection
  function clearSelection() {
    setSelectedForQualify(new Set());
  }

  // Mark selected as qualified
  async function handleMarkQualified() {
    const ids = Array.from(selectedForQualify);
    if (ids.length === 0) return;
    setQualifyLoading(true);
    setMessage(null);
    const result = await markQualified(ids, eventId);
    if (result.success) {
      setQualifiedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setSelectedForQualify(new Set());
      setMessage({
        type: "success",
        text: `Marked ${ids.length} student${ids.length !== 1 ? "s" : ""} as qualified for ${nextLevelLabel}`,
      });
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setQualifyLoading(false);
  }

  // Unmark specific participants
  async function handleUnmarkQualified(participantIds: string[]) {
    if (participantIds.length === 0) return;
    setQualifyLoading(true);
    setMessage(null);
    const result = await unmarkQualified(participantIds, eventId);
    if (result.success) {
      setQualifiedIds((prev) => {
        const next = new Set(prev);
        participantIds.forEach((id) => next.delete(id));
        return next;
      });
      setMessage({
        type: "success",
        text: `Removed qualification for ${participantIds.length} student${participantIds.length !== 1 ? "s" : ""}`,
      });
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setQualifyLoading(false);
  }

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

  // Build award winners map
  const awardWinners = new Map<string, ResultWithParticipant[]>();
  for (const r of results) {
    if (r.award_category) {
      const categories = r.award_category.split(", ");
      for (const cat of categories) {
        const existing = awardWinners.get(cat) ?? [];
        existing.push(r);
        awardWinners.set(cat, existing);
      }
    }
  }

  if (results.length === 0) {
    return (
      <div className="space-y-6">
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

      {/* Award Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AWARD_CARDS.map((award) => {
          const winners = awardWinners.get(award.key);
          if (!winners || winners.length === 0) {
            return (
              <Card key={award.key} className={`${award.bg} border ${award.border} opacity-50`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <award.icon className={`size-8 ${award.iconColor}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {award.label}
                      </p>
                      <p className="mt-1 text-sm text-gray-400 italic">
                        No winner
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={award.key} className={`${award.bg} border ${award.border}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <award.icon className={`size-8 shrink-0 ${award.iconColor}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {award.label}
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

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
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
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-center font-bold text-gray-700">
                        {r.rank}
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
                        {side && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${PARTY_COLORS[side].badge}`}
                          >
                            {side === "ruling" ? "Ruling" : "Opposition"}
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
                        {r.award_category && (
                          <div className="flex flex-wrap gap-1">
                            {r.award_category.split(", ").map((a) => (
                              <Badge
                                key={a}
                                variant="secondary"
                                className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                              >
                                {a}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Qualifiers Section - only for chapter/regional events */}
      {showQualifiers && results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="size-5 text-[#138808]" />
                <CardTitle className="text-base">
                  Qualifiers for {nextLevelLabel}
                </CardTitle>
              </div>
              <p className="text-sm text-gray-500">
                {qualifiedIds.size} of {results.length} students qualified
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {/* Action bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllUnqualified}
                disabled={qualifyLoading}
              >
                Select All Unqualified
              </Button>
              {selectedForQualify.size > 0 && (
                <>
                  <Button
                    size="sm"
                    className="bg-[#138808] text-white hover:bg-[#0f6b06]"
                    onClick={handleMarkQualified}
                    disabled={qualifyLoading}
                  >
                    {qualifyLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Mark {selectedForQualify.size} as Qualified for{" "}
                    {nextLevelLabel}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearSelection}
                    disabled={qualifyLoading}
                  >
                    Clear Selection
                  </Button>
                </>
              )}
              {qualifiedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() =>
                    handleUnmarkQualified(Array.from(qualifiedIds))
                  }
                  disabled={qualifyLoading}
                >
                  Unmark All ({qualifiedIds.size})
                </Button>
              )}
            </div>

            {/* Qualifier table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => {
                    const isQualified = qualifiedIds.has(r.participant_id);
                    const isSelected = selectedForQualify.has(
                      r.participant_id
                    );
                    return (
                      <TableRow
                        key={r.id}
                        className={
                          isQualified
                            ? "bg-green-50/50"
                            : isSelected
                            ? "bg-blue-50/50"
                            : ""
                        }
                      >
                        <TableCell className="text-center">
                          {isQualified ? (
                            <button
                              onClick={() =>
                                handleUnmarkQualified([r.participant_id])
                              }
                              disabled={qualifyLoading}
                              className="rounded p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Remove qualification"
                            >
                              <svg
                                className="size-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                toggleQualifySelection(r.participant_id)
                              }
                              disabled={qualifyLoading}
                              className="size-4 rounded border-gray-300 text-[#138808] focus:ring-[#138808]"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm font-bold text-gray-700">
                          {r.rank}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {r.participant.full_name}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {r.participant.school_name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {r.avg_score?.toFixed(1) ?? "--"}
                        </TableCell>
                        <TableCell className="text-center">
                          {isQualified ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0"
                            >
                              Qualified
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Not selected
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
