"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  getSeasonPipeline,
  promoteToEvent,
} from "@/app/yip/actions/pipeline";
import type { Season, SeasonPipelineData, SeasonEvent } from "@/app/yip/actions/pipeline";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  GitBranch,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronLeft,
  MapPin,
  Trophy,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────

function statusColor(status: string): string {
  const completed = ["completed", "results_published"];
  const inProgress = ["day1_live", "day1_complete", "day2_live"];
  if (completed.includes(status)) return "border-green-300 bg-green-50";
  if (inProgress.includes(status)) return "border-yellow-300 bg-yellow-50";
  return "border-gray-200 bg-white";
}

function statusDot(status: string): string {
  const completed = ["completed", "results_published"];
  const inProgress = ["day1_live", "day1_complete", "day2_live"];
  if (completed.includes(status)) return "bg-green-500";
  if (inProgress.includes(status)) return "bg-yellow-500";
  return "bg-gray-300";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    registration_open: "Reg. Open",
    registration_closed: "Reg. Closed",
    day1_live: "Day 1 Live",
    day1_complete: "Day 1 Done",
    day2_live: "Day 2 Live",
    completed: "Completed",
    results_published: "Published",
  };
  return map[status] ?? status;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ─── Event Card ─────────────────────────────────────────────────

function EventCard({
  event,
  showPromote,
  promoteLabel,
  promoteTargets,
  onPromote,
  promoting,
}: {
  event: SeasonEvent;
  showPromote: boolean;
  promoteLabel: string;
  promoteTargets: SeasonEvent[];
  onPromote: (fromId: string, toId: string) => void;
  promoting: boolean;
}) {
  const [showTargets, setShowTargets] = useState(false);

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${statusColor(event.status)}`}
    >
      <CardContent className="pt-4 pb-4 px-4">
        {/* Status dot + name */}
        <div className="flex items-start gap-2 mb-2">
          <div className={`mt-1.5 size-2.5 shrink-0 rounded-full ${statusDot(event.status)}`} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/yip/dashboard/events/${event.id}`}
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 leading-tight line-clamp-2"
            >
              {event.name}
            </Link>
          </div>
        </div>

        {/* Info */}
        <div className="ml-4.5 space-y-1 text-xs text-gray-500">
          {event.city && (
            <div className="flex items-center gap-1">
              <MapPin className="size-3" />
              {event.city}{event.state ? `, ${event.state}` : ""}
            </div>
          )}
          <div>{formatDate(event.day1_date)} - {formatDate(event.day2_date)}</div>
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {event.participant_count}
            </span>
            {event.qualified_count > 0 && (
              <span className="flex items-center gap-1 text-[#138808] font-medium">
                <CheckCircle2 className="size-3" />
                {event.qualified_count} qualified
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-2 ml-4.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {statusLabel(event.status)}
          </Badge>
        </div>

        {/* Promote button */}
        {showPromote && event.qualified_count > 0 && (
          <div className="mt-3 ml-4.5 relative">
            {promoteTargets.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">
                No {promoteLabel.toLowerCase().replace("promote to ", "")} events to promote to
              </p>
            ) : promoteTargets.length === 1 ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-[#FF9933] text-[#FF9933] hover:bg-[#FF9933]/10"
                onClick={() => onPromote(event.id, promoteTargets[0].id)}
                disabled={promoting}
              >
                {promoting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ArrowRight className="size-3" />
                )}
                {promoteLabel}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-[#FF9933] text-[#FF9933] hover:bg-[#FF9933]/10"
                  onClick={() => setShowTargets(!showTargets)}
                  disabled={promoting}
                >
                  {promoting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3" />
                  )}
                  {promoteLabel}
                </Button>
                {showTargets && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                    {promoteTargets.map((t) => (
                      <button
                        key={t.id}
                        className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          onPromote(event.id, t.id);
                          setShowTargets(false);
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Column ─────────────────────────────────────────────────────

function PipelineColumn({
  title,
  color,
  events,
  emptyMessage,
  children,
}: {
  title: string;
  color: string;
  events: SeasonEvent[];
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const totalParticipants = events.reduce((s, e) => s + e.participant_count, 0);
  const totalQualified = events.reduce((s, e) => s + e.qualified_count, 0);

  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div className={`rounded-t-lg border-t-4 ${color} bg-gray-50 px-4 py-3`}>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
          <span>{events.length} event{events.length !== 1 ? "s" : ""}</span>
          <span>{totalParticipants} participants</span>
          {totalQualified > 0 && (
            <span className="text-[#138808] font-medium">
              {totalQualified} qualified
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-3 rounded-b-lg border border-t-0 border-gray-200 bg-gray-50/50 p-3 min-h-[200px]">
        {events.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-4">
            <Trophy className="mb-2 size-8 text-gray-300" />
            <p className="text-center text-xs text-gray-400">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ─── Connector Arrow ────────────────────────────────────────────

function ConnectorArrow() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center px-2">
      <div className="flex items-center gap-0.5 text-gray-300">
        <div className="h-px w-6 bg-gray-300" />
        <ArrowRight className="size-5" />
      </div>
      <p className="mt-1 text-[10px] text-gray-400 whitespace-nowrap">Top performers</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function PipelineClient({ seasons }: { seasons: Season[] }) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    seasons.find((s) => s.is_active)?.id ?? seasons[0]?.id ?? ""
  );
  const [pipeline, setPipeline] = useState<SeasonPipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [promoting, setPromoting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedSeasonId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getSeasonPipeline(selectedSeasonId).then((data) => {
      setPipeline(data);
      setLoading(false);
    });
  }, [selectedSeasonId]);

  async function handlePromote(fromEventId: string, toEventId: string) {
    setPromoting(true);
    setMessage(null);
    const result = await promoteToEvent(fromEventId, toEventId);
    if (result.success) {
      setMessage({
        type: "success",
        text: `Successfully promoted ${result.data.promoted} student${result.data.promoted !== 1 ? "s" : ""} to the next level`,
      });
      // Refresh
      startTransition(async () => {
        const refreshed = await getSeasonPipeline(selectedSeasonId);
        setPipeline(refreshed);
      });
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setPromoting(false);
  }

  if (seasons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
        <GitBranch className="mb-4 size-12 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-700">No Seasons Found</h3>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Create a season first before viewing the pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/yip/dashboard/admin">
            <Button variant="outline" size="sm">
              <ChevronLeft className="size-4" />
              Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Season Pipeline</h1>
            <p className="text-sm text-gray-500">
              Chapter &rarr; Regional &rarr; National progression
            </p>
          </div>
        </div>
        <select
          value={selectedSeasonId}
          onChange={(e) => setSelectedSeasonId(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.is_active ? "(Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      ) : pipeline ? (
        <>
          {/* Pipeline Visualization - 3 columns with connectors */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-4 lg:gap-0">
            {/* Chapter Events Column */}
            <PipelineColumn
              title="Chapter Events"
              color="border-[#FF9933]"
              events={pipeline.events.chapter}
              emptyMessage="No chapter events yet. Create events from the dashboard."
            >
              {pipeline.events.chapter.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showPromote={true}
                  promoteLabel="Promote to Regional"
                  promoteTargets={pipeline.events.regional}
                  onPromote={handlePromote}
                  promoting={promoting}
                />
              ))}
            </PipelineColumn>

            {/* Arrow */}
            <ConnectorArrow />

            {/* Regional Events Column */}
            <PipelineColumn
              title="Regional Events"
              color="border-blue-500"
              events={pipeline.events.regional}
              emptyMessage="No regional events created yet. Create one from the Admin Dashboard."
            >
              {pipeline.events.regional.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showPromote={true}
                  promoteLabel="Promote to National"
                  promoteTargets={pipeline.events.national}
                  onPromote={handlePromote}
                  promoting={promoting}
                />
              ))}
            </PipelineColumn>

            {/* Arrow */}
            <ConnectorArrow />

            {/* National Event Column */}
            <PipelineColumn
              title="National Event"
              color="border-[#138808]"
              events={pipeline.events.national}
              emptyMessage="No national event created yet. Create regional events first."
            >
              {pipeline.events.national.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showPromote={false}
                  promoteLabel=""
                  promoteTargets={[]}
                  onPromote={handlePromote}
                  promoting={promoting}
                />
              ))}
            </PipelineColumn>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Legend:</span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-green-500" />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-yellow-500" />
              In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-gray-300" />
              Draft / Not Started
            </span>
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-sm text-gray-500">
          Failed to load pipeline data
        </div>
      )}
    </div>
  );
}
