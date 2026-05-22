"use client";

import { useState } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CalendarRange,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  Pencil,
  Plus,
  Star,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import {
  adminArchiveSeason,
  adminCloneSeason,
  adminCreateSeason,
  adminGetSeasonStats,
  adminReactivateSeason,
  adminUpdateSeason,
  type AdminSeason,
  type SeasonInput,
  type SeasonStats,
} from "@/app/actions/yip/admin-seasons";

type StatsMap = Record<string, SeasonStats>;

const EMPTY_STATS: SeasonStats = {
  events_count: 0,
  chapters_count: 0,
  participants_count: 0,
  results_published_count: 0,
};

// ─── Client ────────────────────────────────────────────────────

export function SeasonsClient({
  initialSeasons,
  initialStats,
}: {
  initialSeasons: AdminSeason[];
  initialStats: StatsMap;
}) {
  const [seasons, setSeasons] = useState<AdminSeason[]>(initialSeasons);
  const [stats, setStats] = useState<StatsMap>(initialStats);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSeason | null>(null);
  const [cloneTarget, setCloneTarget] = useState<AdminSeason | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const active = seasons.find((s) => s.is_active) ?? null;
  const archived = seasons.filter((s) => !s.is_active);

  // Default new season year: max(year)+1, fallback current year + 1.
  const nextYearDefault = (() => {
    if (seasons.length === 0) return new Date().getFullYear() + 1;
    return Math.max(...seasons.map((s) => s.year)) + 1;
  })();

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(s: AdminSeason) {
    setEditing(s);
    setEditorOpen(true);
  }

  async function refreshStats(id: string) {
    const fresh = await adminGetSeasonStats(id);
    setStats((prev) => ({ ...prev, [id]: fresh }));
  }

  async function handleSubmit(input: SeasonInput) {
    setMessage(null);
    if (editing) {
      const res = await adminUpdateSeason(editing.id, input);
      if (!res.success) {
        setMessage({ type: "error", text: res.error });
        return false;
      }
      // If we set this active, make all others inactive locally.
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === res.data.id
            ? res.data
            : res.data.is_active
            ? { ...s, is_active: false }
            : s
        )
      );
      setMessage({ type: "success", text: `Updated "${res.data.name}"` });
    } else {
      const res = await adminCreateSeason(input);
      if (!res.success) {
        setMessage({ type: "error", text: res.error });
        return false;
      }
      setSeasons((prev) => {
        const next = res.data.is_active
          ? prev.map((s) => ({ ...s, is_active: false }))
          : [...prev];
        return [res.data, ...next];
      });
      setStats((prev) => ({ ...prev, [res.data.id]: EMPTY_STATS }));
      setMessage({ type: "success", text: `Created "${res.data.name}"` });
    }
    setEditorOpen(false);
    setEditing(null);
    return true;
  }

  async function handleArchive(s: AdminSeason) {
    if (
      !window.confirm(
        `Archive "${s.name}"? This sets is_active=false and prevents assigning new events to this season. Archiving is blocked if any events are still live.`
      )
    )
      return;
    setBusyId(s.id);
    setMessage(null);
    const res = await adminArchiveSeason(s.id);
    setBusyId(null);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setSeasons((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, is_active: false } : x))
    );
    setMessage({ type: "success", text: `Archived "${s.name}"` });
  }

  async function handleReactivate(s: AdminSeason) {
    if (
      active &&
      !window.confirm(
        `Reactivate "${s.name}"? This will archive the current active season "${active.name}" — only one season can be active at a time.`
      )
    )
      return;
    setBusyId(s.id);
    setMessage(null);
    const res = await adminReactivateSeason(s.id);
    setBusyId(null);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setSeasons((prev) =>
      prev.map((x) => ({ ...x, is_active: x.id === s.id }))
    );
    setMessage({ type: "success", text: `"${s.name}" is now the active season` });
  }

  async function handleClone(s: AdminSeason, newYear: number) {
    setBusyId(s.id);
    setMessage(null);
    const res = await adminCloneSeason(s.id, newYear);
    setBusyId(null);
    setCloneTarget(null);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setSeasons((prev) => [res.data, ...prev]);
    setStats((prev) => ({ ...prev, [res.data.id]: EMPTY_STATS }));
    setMessage({
      type: "success",
      text: `Cloned to "${res.data.name}" (${res.data.year}). Reactivate to make it the current season.`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a3e]">Seasons</h1>
          <p className="mt-1 text-sm text-[#1a1a3e]/60">
            Each season is a yearly cycle of YIP (Chapter → Regional → National).
            Only one season can be active at a time.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          New Season
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-[#138808]/30 bg-[#138808]/5 text-[#138808]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">{message.text}</div>
          <button
            onClick={() => setMessage(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Active season */}
      {active && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#FF9933] mb-2 flex items-center gap-2">
            <Crown className="size-3.5" />
            Active Season
          </h2>
          <SeasonCard
            season={active}
            stats={stats[active.id] ?? EMPTY_STATS}
            isActive
            busy={busyId === active.id}
            onEdit={() => openEdit(active)}
            onArchive={() => handleArchive(active)}
            onReactivate={() => handleReactivate(active)}
            onClone={() => setCloneTarget(active)}
            onRefresh={() => refreshStats(active.id)}
          />
        </div>
      )}

      {/* Archived seasons */}
      {archived.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/50 mb-2 flex items-center gap-2">
            <Archive className="size-3.5" />
            Archived Seasons ({archived.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {archived.map((s) => (
              <SeasonCard
                key={s.id}
                season={s}
                stats={stats[s.id] ?? EMPTY_STATS}
                isActive={false}
                busy={busyId === s.id}
                onEdit={() => openEdit(s)}
                onArchive={() => handleArchive(s)}
                onReactivate={() => handleReactivate(s)}
                onClone={() => setCloneTarget(s)}
                onRefresh={() => refreshStats(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {seasons.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarRange className="mb-3 size-10 text-gray-300" />
            <h3 className="text-sm font-semibold text-[#1a1a3e]">
              No seasons yet
            </h3>
            <p className="mt-1 text-xs text-[#1a1a3e]/50 max-w-sm">
              Create your first season (e.g. "YIP 2.0 - 2026") to start hosting
              events.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-[#FF9933] text-white hover:bg-[#E68A2E]"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              New Season
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <SeasonEditorDialog
          season={editing}
          nextYearDefault={nextYearDefault}
          hasActive={!!active && active.id !== editing?.id}
          activeName={active && active.id !== editing?.id ? active.name : null}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {/* Clone modal */}
      {cloneTarget && (
        <CloneDialog
          source={cloneTarget}
          defaultYear={cloneTarget.year + 1}
          busy={busyId === cloneTarget.id}
          onClose={() => setCloneTarget(null)}
          onSubmit={(y) => handleClone(cloneTarget, y)}
        />
      )}
    </div>
  );
}

// ─── Season Card ──────────────────────────────────────────────────

function SeasonCard({
  season,
  stats,
  isActive,
  busy,
  onEdit,
  onArchive,
  onReactivate,
  onClone,
}: {
  season: AdminSeason;
  stats: SeasonStats;
  isActive: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onReactivate: () => void;
  onClone: () => void;
  onRefresh?: () => void;
}) {
  const pctPublished =
    stats.events_count > 0
      ? Math.round(
          (stats.results_published_count / stats.events_count) * 100
        )
      : 0;

  return (
    <Card
      className={
        isActive
          ? "border-2 border-[#FF9933] shadow-[0_4px_16px_0_rgba(255,153,51,0.12)]"
          : "border-[#1a1a3e]/10"
      }
    >
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left — name + year */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isActive ? (
                <Badge
                  variant="secondary"
                  className="bg-[#FF9933]/10 text-[#FF9933] border border-[#FF9933]/30"
                >
                  <Star className="size-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-gray-500"
                >
                  <Archive className="size-3 mr-1" />
                  Archived
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-bold text-[#1a1a3e] truncate">
              {season.name}
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold ${
                  isActive ? "text-[#FF9933]" : "text-[#1a1a3e]/70"
                }`}
              >
                {season.year}
              </span>
            </div>
          </div>

          {/* Right — % published ring */}
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#1a1a3e]/40">
              Results Published
            </p>
            <div className="mt-1 flex items-baseline justify-end gap-1">
              <span
                className={`text-2xl font-bold ${
                  pctPublished === 100
                    ? "text-[#138808]"
                    : pctPublished > 0
                    ? "text-[#FF9933]"
                    : "text-[#1a1a3e]/40"
                }`}
              >
                {pctPublished}
              </span>
              <span className="text-xs text-[#1a1a3e]/40">%</span>
            </div>
            <p className="text-[10px] text-[#1a1a3e]/40">
              {stats.results_published_count} of {stats.events_count}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatPill
            icon={Trophy}
            label="Events"
            value={stats.events_count}
            color="text-[#1a1a3e]"
          />
          <StatPill
            icon={TrendingUp}
            label="Chapters"
            value={stats.chapters_count}
            color="text-blue-600"
          />
          <StatPill
            icon={Users}
            label="Participants"
            value={stats.participants_count}
            color="text-[#138808]"
          />
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-[#1a1a3e]/5">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            disabled={busy}
            className="h-8 text-xs"
          >
            <Pencil className="size-3" />
            Edit
          </Button>
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onArchive}
              disabled={busy}
              className="h-8 text-xs text-red-600 hover:bg-red-50"
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Archive className="size-3" />
              )}
              Archive
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onReactivate}
              disabled={busy}
              className="h-8 text-xs text-[#FF9933] hover:bg-[#FF9933]/10 border-[#FF9933]/30"
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ArchiveRestore className="size-3" />
              )}
              Make Active
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onClone}
            disabled={busy}
            className="h-8 text-xs"
          >
            <Copy className="size-3" />
            Clone
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-[#1a1a3e]/5 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Icon className={`size-3.5 ${color}`} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#1a1a3e]/50">
          {label}
        </span>
      </div>
      <p className={`mt-0.5 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Editor Dialog ────────────────────────────────────────────────

function SeasonEditorDialog({
  season,
  nextYearDefault,
  hasActive,
  activeName,
  onClose,
  onSubmit,
}: {
  season: AdminSeason | null;
  nextYearDefault: number;
  hasActive: boolean;
  activeName: string | null;
  onClose: () => void;
  onSubmit: (input: SeasonInput) => Promise<boolean>;
}) {
  const isEdit = !!season;
  const [name, setName] = useState(
    season?.name ?? `YIP 3.0 - ${nextYearDefault}`
  );
  const [year, setYear] = useState<string>(
    String(season?.year ?? nextYearDefault)
  );
  const [isActiveVal, setIsActiveVal] = useState(season?.is_active ?? false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit() {
    setLocalError(null);
    if (name.trim().length < 3) {
      setLocalError("Name must be at least 3 characters");
      return;
    }
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      setLocalError("Year must be a 4-digit number between 2000 and 2100");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      name: name.trim(),
      year: y,
      is_active: isActiveVal,
    });
    setSaving(false);
    if (!ok) return;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-[#1a1a3e]">
            {isEdit ? "Edit Season" : "New Season"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YIP 3.0 - 2027"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Year
            </Label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm text-[#1a1a3e]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={isActiveVal}
                onChange={(e) => setIsActiveVal(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#FF9933] focus:ring-[#FF9933]"
              />
              <span className="flex-1">
                <span className="font-medium">Set as the active season</span>
                {isActiveVal && hasActive && activeName && (
                  <span className="block mt-0.5 text-[11px] text-amber-600">
                    This will archive the current active season "{activeName}"
                    — only one can be active.
                  </span>
                )}
              </span>
            </label>
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={saving}
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Season"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Clone Dialog ─────────────────────────────────────────────────

function CloneDialog({
  source,
  defaultYear,
  busy,
  onClose,
  onSubmit,
}: {
  source: AdminSeason;
  defaultYear: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: (newYear: number) => void;
}) {
  const [newYear, setNewYear] = useState<string>(String(defaultYear));
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    const y = Number(newYear);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      setLocalError("Year must be a 4-digit number between 2000 and 2100");
      return;
    }
    if (y === source.year) {
      setLocalError("New year must differ from source year");
      return;
    }
    onSubmit(y);
  }

  const previewName = source.name.includes(String(source.year))
    ? source.name.split(String(source.year)).join(newYear || "?")
    : `${source.name} (${newYear || "?"})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a3e]">
              Clone Season
            </h3>
            <p className="mt-0.5 text-xs text-[#1a1a3e]/50">
              Creates a copy of "{source.name}" with a new year.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              New Year
            </Label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={newYear}
              onChange={(e) => {
                setNewYear(e.target.value);
                setLocalError(null);
              }}
            />
          </div>

          <div className="rounded-md bg-[#FF9933]/5 border border-[#FF9933]/20 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#FF9933]">
              Preview
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#1a1a3e]">
              {previewName}
            </p>
            <p className="text-[11px] text-[#1a1a3e]/50">
              Created as archived — reactivate to make it the active season.
            </p>
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={busy}
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            <Copy className="size-4" />
            Clone
          </Button>
        </div>
      </div>
    </div>
  );
}
