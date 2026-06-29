"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  getSeasonPipeline,
  createRegionalEvent,
  createNationalEvent,
} from "@/app/yip/actions/pipeline";
import type { Season, SeasonPipelineData, SeasonEvent } from "@/app/yip/actions/pipeline";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { INK, SAFFRON, SERIF, inkA } from "@/app/yip/me/credential-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  LayoutDashboard,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  GitBranch,
  Filter,
  X,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
    registration_open: { label: "Registration Open", className: "bg-blue-100 text-blue-700" },
    registration_closed: { label: "Registration Closed", className: "bg-yellow-100 text-yellow-700" },
    day1_live: { label: "Day 1 Live", className: "bg-green-100 text-green-800" },
    day1_complete: { label: "Day 1 Complete", className: "bg-emerald-100 text-emerald-700" },
    day2_live: { label: "Day 2 Live", className: "bg-green-100 text-green-800" },
    completed: { label: "Completed", className: "bg-purple-100 text-purple-700" },
    results_published: { label: "Results Published", className: "bg-[#FF9933]/10 text-[#FF9933]" },
  };
  return map[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
}

function levelBadge(level: string) {
  const map: Record<string, { label: string; className: string }> = {
    chapter: { label: "Chapter", className: "bg-[#FF9933]/10 text-[#FF9933]" },
    regional: { label: "Regional", className: "bg-blue-100 text-blue-700" },
    national: { label: "National", className: "bg-[#138808]/10 text-[#138808]" },
  };
  return map[level] ?? { label: level, className: "bg-gray-100 text-gray-700" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Create Event Dialog ────────────────────────────────────────

function CreateEventDialog({
  type,
  open,
  onClose,
  onSubmit,
  loading,
}: {
  type: "regional" | "national";
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    city: string;
    state: string;
    venue_name: string;
    day1_date: string;
    day2_date: string;
  }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [venueName, setVenueName] = useState("");
  const [day1, setDay1] = useState("");
  const [day2, setDay2] = useState("");

  if (!open) return null;

  const label = type === "regional" ? "Regional" : "National";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Create {label} Event
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`YIP ${label} - City`}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue Name (optional)
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day 1 Date
              </label>
              <input
                type="date"
                value={day1}
                onChange={(e) => setDay1(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day 2 Date
              </label>
              <input
                type="date"
                value={day2}
                onChange={(e) => setDay2(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            disabled={!name || !city || !state || !day1 || !day2 || loading}
            onClick={() =>
              onSubmit({ name, city, state, venue_name: venueName, day1_date: day1, day2_date: day2 })
            }
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Create {label} Event
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

export function AdminDashboardClient({ seasons }: { seasons: Season[] }) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    seasons.find((s) => s.is_active)?.id ?? seasons[0]?.id ?? ""
  );
  const [pipeline, setPipeline] = useState<SeasonPipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create event dialogs
  const [showCreateRegional, setShowCreateRegional] = useState(false);
  const [showCreateNational, setShowCreateNational] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

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

  async function handleCreateEvent(
    type: "regional" | "national",
    data: {
      name: string;
      city: string;
      state: string;
      venue_name: string;
      day1_date: string;
      day2_date: string;
    }
  ) {
    setCreateLoading(true);
    setMessage(null);

    const fn = type === "regional" ? createRegionalEvent : createNationalEvent;
    const result = await fn(selectedSeasonId, data);

    if (result.success) {
      setMessage({
        type: "success",
        text: `${type === "regional" ? "Regional" : "National"} event created successfully`,
      });
      if (type === "regional") setShowCreateRegional(false);
      else setShowCreateNational(false);

      // Refresh pipeline data
      startTransition(async () => {
        const refreshed = await getSeasonPipeline(selectedSeasonId);
        setPipeline(refreshed);
      });
    } else {
      setMessage({ type: "error", text: result.error });
    }
    setCreateLoading(false);
  }

  // Get filtered events
  const allEvents: SeasonEvent[] = pipeline
    ? [...pipeline.events.chapter, ...pipeline.events.regional, ...pipeline.events.national]
    : [];

  const filteredEvents = allEvents.filter((e) => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  // Get unique statuses for filter
  const uniqueStatuses = [...new Set(allEvents.map((e) => e.status))];

  if (seasons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
        <LayoutDashboard className="mb-4 size-12 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-700">No Seasons Found</h3>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Create a season first before accessing the admin dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            National Command
          </p>
          <h1
            className="mt-0.5 text-2xl font-bold tracking-tight"
            style={{ ...SERIF, color: INK }}
          >
            Admin Dashboard
          </h1>
          <p className="text-sm" style={{ color: inkA(0.5) }}>
            Manage the multi-level pipeline across seasons
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Link href="/yip/dashboard/admin/pipeline">
            <Button variant="outline" size="sm">
              <GitBranch className="size-4" />
              Pipeline View
            </Button>
          </Link>
        </div>
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
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Chapter Events
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: INK }}>
                  {pipeline.stats.totalChapters}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Regional Events
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: INK }}>
                  {pipeline.stats.totalRegionals}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase text-gray-500">
                  National Event
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: INK }}>
                  {pipeline.stats.totalNationals}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Total Participants
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: INK }}>
                  {pipeline.stats.totalParticipants}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Qualified for Next
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: "#138808" }}>
                  {pipeline.stats.totalQualified}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setShowCreateRegional(true)}
            >
              <Plus className="size-4" />
              Create Regional Event
            </Button>
            <Button
              size="sm"
              className="bg-[#138808] text-white hover:bg-[#0f6b06]"
              onClick={() => setShowCreateNational(true)}
              disabled={pipeline.events.regional.length === 0}
              title={
                pipeline.events.regional.length === 0
                  ? "Create regional events first"
                  : undefined
              }
            >
              <Plus className="size-4" />
              Create National Event
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-gray-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="all">All Levels</option>
              <option value="chapter">Chapter</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusBadge(s).label}
                </option>
              ))}
            </select>
            {(levelFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setLevelFilter("all");
                  setStatusFilter("all");
                }}
                className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Events Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Events ({filteredEvents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No events match the current filters
                </p>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Chapter</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Participants</TableHead>
                        <TableHead className="text-center">Qualified</TableHead>
                        <TableHead>Dates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event) => {
                        const status = statusBadge(event.status);
                        const level = levelBadge(event.level);
                        return (
                          <TableRow key={event.id}>
                            <TableCell>
                              <Link
                                href={`/yip/dashboard/events/${event.id}`}
                                className="font-medium text-sm text-blue-600 hover:underline"
                              >
                                {event.name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {event.chapter_name ?? "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={level.className}>
                                {level.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={status.className}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1 text-sm">
                                <Users className="size-3.5 text-gray-400" />
                                {event.participant_count}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`text-sm font-medium ${
                                  event.qualified_count > 0
                                    ? "text-[#138808]"
                                    : "text-gray-400"
                                }`}
                              >
                                {event.qualified_count}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {formatDate(event.day1_date)}
                              {event.city && (
                                <span className="ml-1">
                                  <MapPin className="inline size-3 text-gray-400" />{" "}
                                  {event.city}
                                </span>
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
        </>
      ) : (
        <div className="py-16 text-center text-sm text-gray-500">
          Failed to load pipeline data
        </div>
      )}

      {/* Create Event Dialogs */}
      <CreateEventDialog
        type="regional"
        open={showCreateRegional}
        onClose={() => setShowCreateRegional(false)}
        onSubmit={(data) => handleCreateEvent("regional", data)}
        loading={createLoading}
      />
      <CreateEventDialog
        type="national"
        open={showCreateNational}
        onClose={() => setShowCreateNational(false)}
        onSubmit={(data) => handleCreateEvent("national", data)}
        loading={createLoading}
      />
    </div>
  );
}
