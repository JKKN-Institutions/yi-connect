"use client";

/**
 * Self-Nomination results — organiser client.
 *
 * Reads only. The one write on this page is the explicit open/close toggle
 * (behind a confirm dialog, because closing mid-flight cuts students off).
 * Nothing here feeds the ballot: candidate selection stays on the Control panel
 * exactly as it was (Director decision 1).
 */

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Download,
  Info,
  Inbox,
  Loader2,
  RefreshCw,
  SearchX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ParticipantNameButton } from "@/components/yip/participant-profile-dialog";
import { cn } from "@/lib/yip/utils";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";
import {
  SELF_NOMINATION_ROLES,
  constituencyLabel,
  formatSelfNominationTime,
  selfNominationRoleLabel,
  type SelfNominationResultRow,
  type SelfNominationRole,
  type SelfNominationStats,
} from "@/lib/yip/self-nomination";
import {
  exportSelfNominationsCsv,
  getSelfNominationResults,
  setSelfNominationOpen,
} from "@/app/yip/actions/self-nomination";

type RoleFilter = "all" | SelfNominationRole;
type SortKey = "recent" | "party" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Newest first" },
  { key: "party", label: "Group by party" },
  { key: "name", label: "Name A–Z" },
];

/** Per-role badge tint — matched to the dashboard's existing accent palette. */
const ROLE_BADGE: Record<SelfNominationRole, string> = {
  parliamentary_administrator:
    "border-[#1a1a3e]/15 bg-[#1a1a3e]/[0.06] text-[#1a1a3e]",
  speaker: "border-[#FF9933]/30 bg-[#FF9933]/10 text-[#C2691A]",
  party_leader: "border-[#138808]/25 bg-[#138808]/10 text-[#0f7006]",
  parliamentary_journalist:
    "border-[#6a4a9c]/25 bg-[#6a4a9c]/10 text-[#5a3d87]",
  prime_minister: "border-[#138808]/35 bg-[#138808]/15 text-[#0b5a04]",
  leader_of_opposition:
    "border-[#8a2b27]/25 bg-[#8a2b27]/10 text-[#8a2b27]",
  cabinet_minister: "border-[#138808]/25 bg-[#138808]/[0.08] text-[#0f7006]",
  shadow_minister: "border-[#6a4a9c]/25 bg-[#6a4a9c]/[0.08] text-[#5a3d87]",
};

export function NominationsClient({
  eventId,
  eventName,
  canManage,
  initialOpen,
  initialRows,
  initialStats,
  initialError,
}: {
  eventId: string;
  eventName: string;
  canManage: boolean;
  initialOpen: boolean;
  initialRows: SelfNominationResultRow[];
  initialStats: SelfNominationStats;
  initialError: string | null;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [rows, setRows] = useState(initialRows);
  const [stats, setStats] = useState(initialStats);
  const [error, setError] = useState(initialError);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const controlHref = `/yip/dashboard/events/${eventId}/control`;

  // ── Filter + sort ─────────────────────────────────────────────
  const visible = useMemo(() => {
    const filtered =
      filter === "all" ? rows : rows.filter((r) => r.roles.includes(filter));
    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (sort === "party") {
      sorted.sort((a, b) => {
        // Unassigned students sink to the bottom rather than heading the list.
        const pa = a.partyName ?? "￿";
        const pb = b.partyName ?? "￿";
        if (pa !== pb) return pa.localeCompare(pb);
        return a.fullName.localeCompare(b.fullName);
      });
    } else {
      sorted.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    }
    return sorted;
  }, [rows, filter, sort]);

  // ── Actions ───────────────────────────────────────────────────
  async function refresh() {
    setRefreshing(true);
    const res = await getSelfNominationResults(eventId);
    setRefreshing(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setOpen(res.data.open);
    setRows(res.data.rows);
    setStats(res.data.stats);
    setError(null);
  }

  function applyToggle() {
    const next = !open;
    startTransition(async () => {
      const res = await setSelfNominationOpen(eventId, next);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setOpen(res.data.open);
      setConfirmOpen(false);
      toast.success(
        res.data.open ? "Nominations are now open" : "Nominations are now closed"
      );
    });
  }

  function handleExport() {
    startTransition(async () => {
      const res = await exportSelfNominationsCsv(eventId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            Before the Event
          </p>
          <h2
            className="mt-0.5 text-xl font-bold tracking-tight"
            style={{ ...SERIF, color: INK }}
          >
            Nominations
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#1a1a3e]/60">
            Students put themselves forward for Administrator, Speaker or Party
            Leader from their own phones, before event day. A student may
            nominate for more than one role.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="border-[#1a1a3e]/20"
          >
            {refreshing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            Refresh
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={handleExport}
              disabled={isPending || rows.length === 0}
              className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            >
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Session control ────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                open ? "bg-[#138808]" : "bg-[#1a1a3e]/25"
              )}
            />
            <div>
              <p className="text-sm font-bold text-[#1a1a3e]">
                {open ? "Nominations open" : "Nominations closed"}
              </p>
              <p className="mt-0.5 max-w-xl text-xs text-[#1a1a3e]/60">
                {open
                  ? "Students can submit and edit their nomination right now."
                  : "Students cannot submit or edit. Anything already submitted is kept and stays visible to them."}
              </p>
            </div>
          </div>
          {canManage ? (
            <Button
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className={cn(
                "text-white",
                open
                  ? "bg-[#1a1a3e] hover:bg-[#2d2d5f]"
                  : "bg-[#138808] hover:bg-[#0f7006]"
              )}
            >
              {open ? "End nominations" : "Start nominations"}
            </Button>
          ) : (
            <p className="text-xs text-[#1a1a3e]/45">
              Only this event&apos;s organisers can open or close nominations.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Read-only signpost (Director decision 1) ───── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.02] p-3 text-xs text-[#1a1a3e]/70">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#FF9933]" />
        <p>
          This is a list to read, not a ballot. Nothing is added automatically —
          when you open the Speaker or Party Leader ballots on the{" "}
          <Link
            href={controlHref}
            className="font-semibold text-[#FF9933] underline underline-offset-2"
          >
            Control panel
          </Link>
          , pick your candidates from these names so nobody who nominated is
          missed.
        </p>
      </div>

      {/* ── Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Students nominated"
          value={stats.total}
          sublabel="one row each, however many roles"
          highlight
        />
        {SELF_NOMINATION_ROLES.map((r) => (
          <StatCard
            key={r.key}
            label={r.label}
            value={stats.perRole[r.key] ?? 0}
            sublabel={r.description}
          />
        ))}
      </div>

      {/* ── Filter chips + sort ────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={stats.total}
          />
          {SELF_NOMINATION_ROLES.map((r) => (
            <Chip
              key={r.key}
              active={filter === r.key}
              onClick={() => setFilter(r.key)}
              label={r.label}
              count={stats.perRole[r.key] ?? 0}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#1a1a3e]/45">Sort</span>
          <div className="flex overflow-hidden rounded-md border border-[#1a1a3e]/15">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  sort === s.key
                    ? "bg-[#1a1a3e] text-white"
                    : "bg-white text-[#1a1a3e]/60 hover:bg-[#1a1a3e]/5"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results table ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1a1a3e]">
            <UserCheck className="size-4 text-[#FF9933]" />
            {visible.length} {visible.length === 1 ? "student" : "students"}
            {filter !== "all" && (
              <span className="font-medium text-[#1a1a3e]/50">
                · {selfNominationRoleLabel(filter)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No nominations yet"
              body={
                open
                  ? "Nominations are open. Students who submit from their phones will appear here — hit Refresh to check."
                  : "Nobody has nominated yet. Use “Start nominations” above to open the window so students can put themselves forward."
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={`No ${selfNominationRoleLabel(filter)} nominations`}
              body="Nobody has nominated for this role. Clear the filter to see every nomination."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#1a1a3e]/20"
                  onClick={() => setFilter("all")}
                >
                  Show all
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1a1a3e]/[0.03]">
                    <TableHead className="w-[24%]">Student</TableHead>
                    <TableHead className="w-[20%]">Constituency</TableHead>
                    <TableHead className="w-[18%]">Party</TableHead>
                    <TableHead>Nominated for</TableHead>
                    <TableHead className="w-[15%]">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row, i) => {
                    // In party-sort the table doubles as a grouped list, so the
                    // organiser can work one party's ballot at a time.
                    const showGroup =
                      sort === "party" &&
                      (i === 0 || visible[i - 1].partyName !== row.partyName);
                    return (
                      <Fragment key={row.nominationId}>
                        {showGroup && (
                          <TableRow className="bg-[#1a1a3e]/[0.04] hover:bg-[#1a1a3e]/[0.04]">
                            <TableCell
                              colSpan={5}
                              className="py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1a1a3e]/55"
                            >
                              {row.partyName ?? "No party assigned"}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell className="font-medium text-[#1a1a3e]">
                            {/* Click the name to see the whole student without
                                leaving the table — and without losing the
                                filter or sort you are working through. */}
                            <ParticipantNameButton
                              eventId={eventId}
                              eventName={eventName}
                              participantId={row.participantId}
                              name={row.fullName}
                            />
                          </TableCell>
                          <TableCell className="text-[#1a1a3e]/70">
                            {constituencyLabel(
                              row.constituencyName,
                              row.constituencyNumber
                            ) || "—"}
                          </TableCell>
                          <TableCell>
                            {row.partyName ? (
                              <span className="text-[#1a1a3e]/80">
                                {row.partyName}
                                {row.partySide && (
                                  <span className="ml-1.5 text-[11px] text-[#1a1a3e]/45">
                                    {row.partySide === "ruling"
                                      ? "Ruling"
                                      : "Opposition"}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[#1a1a3e]/35">
                                Not assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.roles.map((r) => (
                                <span
                                  key={r}
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                    ROLE_BADGE[r]
                                  )}
                                >
                                  {selfNominationRoleLabel(r)}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-[#1a1a3e]/55">
                            {formatSelfNominationTime(row.submittedAt) || "—"}
                            {row.updatedAt !== row.submittedAt && (
                              <span className="block text-[10px] text-[#1a1a3e]/35">
                                edited{" "}
                                {formatSelfNominationTime(row.updatedAt)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Confirm toggle ─────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open ? "End nominations?" : "Start nominations?"}
            </DialogTitle>
            <DialogDescription>
              {open
                ? "Students will no longer be able to submit or change their nomination. Nothing already submitted is deleted, and you can start nominations again at any time."
                : "Students will be able to put themselves forward for Administrator, Speaker or Party Leader, and edit their choice until you end nominations."}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800">
              Anyone part-way through their form right now will be cut off.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={applyToggle}>
              {isPending
                ? "Saving..."
                : open
                  ? "End nominations"
                  : "Start nominations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Small pieces ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: number;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 shadow-sm",
        highlight
          ? "border-[#FF9933]/25 bg-[#FF9933]/[0.06]"
          : "border-[#1a1a3e]/10 bg-white"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/45">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-black text-[#1a1a3e]">{value}</p>
      {sublabel && (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#1a1a3e]/45">
          {sublabel}
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[#FF9933] bg-[#FF9933]/10 text-[#C2691A]"
          : "border-[#1a1a3e]/15 bg-white text-[#1a1a3e]/60 hover:bg-[#1a1a3e]/5"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10px] font-bold",
          active ? "bg-[#FF9933]/20" : "bg-[#1a1a3e]/8"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Inbox;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="size-8 text-[#1a1a3e]/20" />
      <p className="mt-3 text-sm font-bold text-[#1a1a3e]">{title}</p>
      <p className="mt-1 max-w-md text-sm text-[#1a1a3e]/55">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
