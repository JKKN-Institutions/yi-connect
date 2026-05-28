"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  lockScores,
  unlockScores,
  computeResults,
} from "@/app/yip/actions/results";
import type { ScoringProgressData } from "@/app/yip/actions/results";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
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
  Lock,
  Unlock,
  Calculator,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star,
  Users,
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

function statusColor(
  scored: number,
  total: number
): "green" | "yellow" | "red" {
  if (total === 0) return "red";
  if (scored >= total) return "green";
  if (scored > 0) return "yellow";
  return "red";
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
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { event, totalParticipants, participantsScored, juryProgress, participantProgress } = data;
  const progressPercent =
    totalParticipants > 0
      ? Math.round((participantsScored / totalParticipants) * 100)
      : 0;

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
                {juryProgress.reduce((s, j) => s + j.scoresSubmitted, 0)}
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
                    <TableHead className="text-center">Scores Submitted</TableHead>
                    <TableHead className="text-right">Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {juryProgress.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">
                        {j.jury_name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={
                            j.scoresSubmitted >= totalParticipants
                              ? "bg-green-100 text-green-700"
                              : j.scoresSubmitted > 0
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-500"
                          }
                        >
                          {j.scoresSubmitted} / {totalParticipants}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        <RelativeTime dateStr={j.lastActivity} />
                      </TableCell>
                    </TableRow>
                  ))}
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
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Juries Scored</TableHead>
                    <TableHead className="text-right">Avg So Far</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantProgress.map((p) => {
                    const color = statusColor(p.juriesScored, p.totalJuries);
                    const side = p.party_side as "ruling" | "opposition" | null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {p.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {p.school_name}
                            </p>
                          </div>
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
                            {side && (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${PARTY_COLORS[side].badge}`}
                              >
                                {side === "ruling" ? "Ruling" : "Opposition"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLES[color]}
                          >
                            {p.juriesScored} / {p.totalJuries}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {p.avgScoreSoFar !== null
                            ? p.avgScoreSoFar.toFixed(1)
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <div
                            className={`size-2.5 rounded-full ${STATUS_DOTS[color]}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
