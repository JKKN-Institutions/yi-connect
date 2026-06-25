"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  runAllocationAction,
  lockAllocation,
  unlockAllocation,
  updateParticipantAssignment,
} from "@/app/yip/actions/allocation";
import {
  MINISTRIES,
  COMMITTEES,
  ROLE_LABELS,
  PARTY_COLORS,
  PARLIAMENT_ROLES,
} from "@/lib/yip/constants";
import { committeeLabel } from "@/lib/yip/committee-label";
import { AllocatedRosterImport } from "@/components/yip/allocated-roster-import";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/yip/ui/dialog";
import {
  Shuffle,
  Lock,
  Unlock,
  RotateCcw,
  Loader2,
  Users,
  Crown,
  MapPin,
  Pencil,
  AlertTriangle,
  Shield,
  Check,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────

type Participant = {
  id: string;
  full_name: string;
  school_name: string;
  class: number;
  home_state: string | null;
  party_side: string | null;
  parliament_role: string | null;
  ministry: string | null;
  constituency_name: string | null;
  constituency_number: number | null;
  constituency_state: string | null;
  committee_name: string | null;
  serial_no: number | null;
  party_number: number | null;
  committee_number: number | null;
};

interface AllocationClientProps {
  eventId: string;
  participants: Participant[];
  parties: { party_number: number | null; name: string; side: string | null }[];
  allocationLocked: boolean;
  customCommittees?: string[];
  rulingPartyCount: number;
  oppositionPartyCount: number;
}

// ─── Component ─────────────────────────────────────────────────────

export function AllocationClient({
  eventId,
  participants,
  parties,
  allocationLocked,
  customCommittees,
  rulingPartyCount,
  oppositionPartyCount,
}: AllocationClientProps) {
  const router = useRouter();
  // Map a participant's party_number → its named party, so the allocation view
  // can show WHO is in WHICH party (not just a bare number).
  const partyByNumber = new Map(
    parties.filter((p) => p.party_number != null).map((p) => [p.party_number, p])
  );
  const partyName = (n: number | null): string | null =>
    n == null ? null : (partyByNumber.get(n)?.name ?? `Party ${n}`);
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  const committeeNames = customCommittees && customCommittees.length > 0
    ? customCommittees
    : [...COMMITTEES];

  // Check if allocation has been run. A full (auto-form) run sets party_side;
  // a blank-bench run leaves party_side null but still assigns constituencies,
  // so treat a populated constituency as "allocated" too — otherwise the screen
  // would loop back to "Ready to Allocate" after a blank-bench run.
  const hasAllocation = participants.some(
    (p) => p.party_side !== null || !!p.constituency_name
  );

  // ── Derived Data ──────────────────────────────────────────────────

  const ruling = useMemo(
    () => participants.filter((p) => p.party_side === "ruling"),
    [participants]
  );
  const opposition = useMemo(
    () => participants.filter((p) => p.party_side === "opposition"),
    [participants]
  );
  // Benchless events (the default now) have no ruling/opposition until event
  // day. Only legacy benched events show the Ruling/Opposition visuals.
  const hasBenches = ruling.length > 0 || opposition.length > 0;
  const hasLeaders = useMemo(
    () =>
      participants.some(
        (p) => p.parliament_role && p.parliament_role !== "mp"
      ),
    [participants]
  );

  const leaders = useMemo(() => {
    const pm = participants.find((p) => p.parliament_role === "prime_minister");
    const lop = participants.find((p) => p.parliament_role === "leader_of_opposition");
    const speakers = participants.filter((p) => p.parliament_role === "speaker");
    const cabinetMinisters = participants.filter(
      (p) => p.parliament_role === "cabinet_minister"
    );
    const shadowMinisters = participants.filter(
      (p) => p.parliament_role === "shadow_minister"
    );
    return { pm, lop, speakers, cabinetMinisters, shadowMinisters };
  }, [participants]);

  const committeeData = useMemo(() => {
    return committeeNames.map((name) => {
      const members = participants.filter((p) => p.committee_name === name);
      const rulingMembers = members.filter((m) => m.party_side === "ruling");
      const oppositionMembers = members.filter((m) => m.party_side === "opposition");
      // Permanent global committee number (catalogue topic_number), carried on
      // each allocated participant — the same number in every event.
      const number = members[0]?.committee_number ?? null;
      return { name, number, members, rulingMembers, oppositionMembers };
    });
  }, [participants, committeeNames]);

  // ── Handlers ──────────────────────────────────────────────────────

  async function handleRunAllocation() {
    setLoading(true);
    const result = await runAllocationAction(eventId);
    if (result.success) {
      toast.success(
        "Students split evenly across parties & constituencies assigned"
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
    setConfirmRerun(false);
  }

  async function handleLock() {
    setLockLoading(true);
    const result = await lockAllocation(eventId);
    if (result.success) {
      toast.success("Allocation locked");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLockLoading(false);
    setConfirmLock(false);
  }

  async function handleUnlock() {
    setLockLoading(true);
    const result = await unlockAllocation(eventId);
    if (result.success) {
      toast.success("Allocation unlocked");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLockLoading(false);
    setConfirmUnlock(false);
  }

  async function handleFieldChange(
    participantId: string,
    field:
      | "party_side"
      | "party_number"
      | "parliament_role"
      | "ministry"
      | "committee_name"
      | "constituency_name",
    value: string | null
  ) {
    const result = await updateParticipantAssignment(
      participantId,
      eventId,
      field,
      value
    );
    if (result.success) {
      toast.success("Updated successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ── Setup / Not-Yet-Allocated State (guided) ──────────────────────
  // A clueless organiser shouldn't have to know to hop between tabs. Show the
  // three prerequisites as an inline checklist with a button for each, and keep
  // "Run Allocation" locked until all three are done. Benchless: Ruling vs
  // Opposition is decided on event day, so there's no bench/role choice here.

  if (!hasAllocation) {
    const studentCount = participants.length;
    const committeeCount = customCommittees?.length ?? 0;
    const partyCount = parties.length;
    const ready = studentCount > 0 && committeeCount > 0 && partyCount > 0;

    const steps = [
      {
        n: 1,
        done: studentCount > 0,
        title: "Add students",
        doneText: `${studentCount} student${studentCount === 1 ? "" : "s"} added`,
        todo: "Add the participants for this event",
        href: `/yip/dashboard/events/${eventId}/participants`,
        cta: "Add students",
      },
      {
        n: 2,
        done: committeeCount > 0,
        title: "Choose committees",
        doneText: `${committeeCount} committee${committeeCount === 1 ? "" : "s"} chosen`,
        todo: "Pick the committees students will debate in",
        href: `/yip/dashboard/events/${eventId}/topics`,
        cta: "Choose committees",
      },
      {
        n: 3,
        done: partyCount > 0,
        title: "Create parties",
        doneText: `${partyCount} part${partyCount === 1 ? "y" : "ies"} created`,
        todo: "Create the parties (5 is standard)",
        href: `/yip/dashboard/events/${eventId}/parties`,
        cta: "Create parties",
      },
    ];

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Auto-allocate — guided 3-step checklist */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shuffle className="size-5 text-[#FF9933]" />
              <h3 className="text-lg font-semibold text-gray-800">Auto-allocate</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              The app splits students evenly into parties and gives each a
              constituency. Finish these three steps, then run allocation.
            </p>

            <div className="mt-4 space-y-2">
              {steps.map((s) => (
                <div
                  key={s.n}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    s.done ? "border-green-200 bg-green-50/50" : "border-gray-200"
                  }`}
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      s.done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.done ? <Check className="size-4" /> : s.n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800">{s.title}</div>
                    <div className="text-xs text-gray-500">
                      {s.done ? s.doneText : s.todo}
                    </div>
                  </div>
                  <Link
                    href={s.href}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                      s.done
                        ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        : "bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                    }`}
                  >
                    {s.done ? "Edit" : s.cta}
                    {!s.done && <ArrowRight className="size-3" />}
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col items-center">
              <Button
                className="bg-[#FF9933] text-white hover:bg-[#E68A2E] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => handleRunAllocation()}
                disabled={!ready || loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Shuffle className="size-4" />
                )}
                {loading ? "Running Allocation..." : "Run Allocation"}
              </Button>
              {!ready && (
                <p className="mt-2 text-xs text-amber-600">
                  Finish the steps above to enable allocation.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manual alternative — upload a pre-allocated roster */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-800">
              Or upload an allocated roster
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Already allocated by National? Upload their sheet —{" "}
              <span className="font-medium">
                SRN, Name, Party, Committee, Constituency, State / UT
              </span>{" "}
              — and the app creates each student (with an access code) and their
              full allocation. No steps needed.
            </p>
            <div className="mt-3">
              <AllocatedRosterImport
                eventId={eventId}
                allocationLocked={allocationLocked}
                existingNames={participants.map((p) => p.full_name)}
                onImported={() => router.refresh()}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main Allocation View ──────────────────────────────────────────

  const rulingPct = participants.length > 0
    ? Math.round((ruling.length / participants.length) * 100)
    : 0;
  const oppositionPct = 100 - rulingPct;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Allocation</h2>
          {allocationLocked ? (
            <Badge className="bg-green-100 text-green-800">
              <Lock className="mr-1 size-3" />
              Locked
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              <Unlock className="mr-1 size-3" />
              Unlocked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!allocationLocked && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRerun(true)}
                disabled={loading}
              >
                <RotateCcw className="size-4" />
                Re-run
              </Button>
              <Button
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => setConfirmLock(true)}
                disabled={lockLoading}
              >
                <Lock className="size-4" />
                Lock Allocation
              </Button>
            </>
          )}
          {allocationLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnlock(true)}
              disabled={lockLoading}
            >
              <Unlock className="size-4" />
              Unlock
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: Party Breakdown — legacy benched events only */}
      {hasBenches && (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Ruling */}
        <div className={`rounded-lg border-2 ${PARTY_COLORS.ruling.border} ${PARTY_COLORS.ruling.bg} p-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-base font-semibold ${PARTY_COLORS.ruling.text}`}>
              Ruling Party
            </h3>
            <Badge className={PARTY_COLORS.ruling.badge}>
              {ruling.length} ({rulingPct}%)
            </Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${rulingPct}%` }}
            />
          </div>
          {/* School breakdown removed — school is never shown in the platform. */}
        </div>

        {/* Opposition */}
        <div className={`rounded-lg border-2 ${PARTY_COLORS.opposition.border} ${PARTY_COLORS.opposition.bg} p-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-base font-semibold ${PARTY_COLORS.opposition.text}`}>
              Opposition Party
            </h3>
            <Badge className={PARTY_COLORS.opposition.badge}>
              {opposition.length} ({oppositionPct}%)
            </Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-red-200">
            <div
              className="h-full rounded-full bg-red-600 transition-all"
              style={{ width: `${oppositionPct}%` }}
            />
          </div>
          {/* School breakdown removed — school is never shown in the platform. */}
        </div>
      </div>
      )}

      {/* Section 2: Leadership Roles — only once roles have been assigned */}
      {hasLeaders && (
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800">
          <Crown className="size-4 text-amber-500" />
          Leadership Roles
        </h3>
        <div className="overflow-hidden rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Ministry</TableHead>
                {!allocationLocked && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Speaker Candidates */}
              {leaders.speakers.map((p) => (
                <LeaderRow
                  key={p.id}
                  participant={p}
                  locked={allocationLocked}
                  onEdit={() => setEditingParticipant(p)}
                />
              ))}
              {/* PM */}
              {leaders.pm && (
                <LeaderRow
                  participant={leaders.pm}
                  locked={allocationLocked}
                  onEdit={() => setEditingParticipant(leaders.pm!)}
                />
              )}
              {/* LoP */}
              {leaders.lop && (
                <LeaderRow
                  participant={leaders.lop}
                  locked={allocationLocked}
                  onEdit={() => setEditingParticipant(leaders.lop!)}
                />
              )}
              {/* Cabinet Ministers */}
              {leaders.cabinetMinisters.map((p) => (
                <LeaderRow
                  key={p.id}
                  participant={p}
                  locked={allocationLocked}
                  onEdit={() => setEditingParticipant(p)}
                />
              ))}
              {/* Shadow Ministers */}
              {leaders.shadowMinisters.map((p) => (
                <LeaderRow
                  key={p.id}
                  participant={p}
                  locked={allocationLocked}
                  onEdit={() => setEditingParticipant(p)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* Section 3: Committee Distribution */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800">
          <Shield className="size-4 text-purple-500" />
          Committee Distribution
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {committeeData.map((committee) => (
            <Card key={committee.name} className="overflow-hidden">
              <div className="border-b bg-gray-50 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800 leading-tight">
                    {committee.number != null ? `${committee.number}. ` : ""}
                    {committee.name}
                  </h4>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {committee.members.length}
                  </Badge>
                </div>
                {hasBenches && (
                  <div className="mt-1 flex gap-3 text-xs text-gray-500">
                    <span className="text-blue-600">
                      Ruling: {committee.rulingMembers.length}
                    </span>
                    <span className="text-red-600">
                      Opp: {committee.oppositionMembers.length}
                    </span>
                  </div>
                )}
              </div>
              <CardContent className="max-h-48 overflow-y-auto p-3">
                <div className="space-y-1">
                  {committee.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate text-gray-700">{m.full_name}</span>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {m.party_side && (
                          <span
                            className={`inline-block size-2 rounded-full ${
                              m.party_side === "ruling" ? "bg-blue-500" : "bg-red-500"
                            }`}
                          />
                        )}
                        {m.parliament_role && m.parliament_role !== "mp" && (
                          <span className="text-[10px] text-gray-400">
                            {ROLE_LABELS[m.parliament_role] ?? m.parliament_role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {committee.members.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No members</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Section: By Party — who is in which named party */}
      {parties.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800">
            <Users className="size-4 text-[#FF9933]" />
            By Party
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...parties]
              .filter((pt) => pt.party_number != null)
              .sort((a, b) => (a.party_number ?? 0) - (b.party_number ?? 0))
              .map((pt) => {
                const members = participants.filter(
                  (p) => p.party_number === pt.party_number
                );
                return (
                  <Card key={pt.party_number}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {pt.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {members.length}
                        </span>
                      </div>
                      {members.length === 0 ? (
                        <p className="text-xs italic text-gray-400">No members</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {members.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate text-gray-700">
                                {m.full_name}
                              </span>
                              {m.parliament_role &&
                                m.parliament_role !== "mp" && (
                                  <span className="shrink-0 text-[10px] text-gray-400">
                                    {ROLE_LABELS[m.parliament_role] ??
                                      m.parliament_role}
                                  </span>
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Section 4: Constituency Assignments */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800">
          <MapPin className="size-4 text-green-500" />
          Constituency Assignments
        </h3>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">S.No</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Constituency</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Committee</TableHead>
                {!allocationLocked && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs tabular-nums text-[#1a1a3e]/70">
                    {p.serial_no ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-xs">
                    {partyName(p.party_number) ?? (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">
                      {p.parliament_role
                        ? ROLE_LABELS[p.parliament_role] ?? p.parliament_role
                        : "--"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.constituency_number != null && (
                      <span className="mr-1 font-mono text-gray-400">
                        #{p.constituency_number}
                      </span>
                    )}
                    {p.constituency_name || "--"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {p.constituency_state || "--"}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">
                    {p.committee_name ?? committeeLabel(p.committee_number)}
                  </TableCell>
                  {!allocationLocked && (
                    <TableCell>
                      <button
                        onClick={() => setEditingParticipant(p)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit assignment"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────── */}

      {/* Re-run Confirmation */}
      <Dialog open={confirmRerun} onOpenChange={setConfirmRerun}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Re-run Allocation?
            </DialogTitle>
            <DialogDescription>
              This will overwrite all current party, role, ministry, constituency,
              and committee assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
              onClick={() => handleRunAllocation()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              {loading ? "Running..." : "Re-run Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Confirmation */}
      <Dialog open={confirmLock} onOpenChange={setConfirmLock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-5 text-green-600" />
              Lock Allocation?
            </DialogTitle>
            <DialogDescription>
              Locking will finalize all assignments. No re-runs, no manual
              overrides, and no participant changes will be allowed until unlocked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleLock}
              disabled={lockLoading}
            >
              {lockLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              {lockLoading ? "Locking..." : "Lock Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Confirmation */}
      <Dialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="size-5 text-amber-500" />
              Unlock Allocation?
            </DialogTitle>
            <DialogDescription>
              This will allow changes to the allocation including re-runs,
              manual overrides, and participant additions/deletions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="outline"
              onClick={handleUnlock}
              disabled={lockLoading}
            >
              {lockLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unlock className="size-4" />
              )}
              {lockLoading ? "Unlocking..." : "Unlock Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Participant Assignment Dialog */}
      {editingParticipant && (
        <EditAssignmentDialog
          participant={editingParticipant}
          parties={parties}
          committeeNames={committeeNames}
          onClose={() => setEditingParticipant(null)}
          onSave={handleFieldChange}
        />
      )}
    </div>
  );
}

// ─── Leader Row Sub-component ────────────────────────────────────────

function LeaderRow({
  participant,
  locked,
  onEdit,
}: {
  participant: Participant;
  locked: boolean;
  onEdit: () => void;
}) {
  const ministryLabel = (key: string | null) => {
    if (!key) return "--";
    const m = MINISTRIES.find((m) => m.key === key);
    return m ? m.label : key;
  };

  return (
    <TableRow>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            participant.parliament_role
              ? roleColor(participant.parliament_role)
              : "bg-gray-100 text-gray-700"
          }
        >
          {participant.parliament_role
            ? ROLE_LABELS[participant.parliament_role] ?? participant.parliament_role
            : "--"}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{participant.full_name}</TableCell>
      <TableCell>
        {participant.party_side ? (
          <Badge
            variant="secondary"
            className={
              PARTY_COLORS[participant.party_side as keyof typeof PARTY_COLORS]
                ?.badge ?? "bg-gray-100 text-gray-700"
            }
          >
            {participant.party_side === "ruling" ? "Ruling" : "Opp"}
          </Badge>
        ) : participant.party_number != null ? (
          // Benchless: Ruling vs Opposition is decided live on event day, so
          // show the party letter (A–G) with a neutral saffron accent — never
          // a side label.
          <Badge
            variant="secondary"
            className="bg-[#FF9933]/15 text-[#9a5212]"
          >
            Party {String.fromCharCode(64 + participant.party_number)}
          </Badge>
        ) : (
          "--"
        )}
      </TableCell>
      <TableCell className="text-xs">
        {ministryLabel(participant.ministry)}
      </TableCell>
      {!locked && (
        <TableCell>
          <button
            onClick={onEdit}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Edit assignment"
          >
            <Pencil className="size-3.5" />
          </button>
        </TableCell>
      )}
    </TableRow>
  );
}

// ─── Role Color Helper ──────────────────────────────────────────────

function roleColor(role: string): string {
  const map: Record<string, string> = {
    speaker: "bg-amber-100 text-amber-800",
    deputy_speaker: "bg-amber-50 text-amber-700",
    prime_minister: "bg-blue-100 text-blue-800",
    leader_of_opposition: "bg-red-100 text-red-800",
    cabinet_minister: "bg-blue-50 text-blue-700",
    shadow_minister: "bg-red-50 text-red-700",
    bill_committee: "bg-purple-50 text-purple-700",
    mp: "bg-gray-100 text-gray-700",
  };
  return map[role] ?? "bg-gray-100 text-gray-700";
}

// ─── Edit Assignment Dialog ─────────────────────────────────────────

function EditAssignmentDialog({
  participant,
  parties,
  committeeNames,
  onClose,
  onSave,
}: {
  participant: Participant;
  parties: { party_number: number | null; name: string; side: string | null }[];
  committeeNames: string[];
  onClose: () => void;
  onSave: (
    id: string,
    field:
      | "party_side"
      | "party_number"
      | "parliament_role"
      | "ministry"
      | "committee_name"
      | "constituency_name",
    value: string | null
  ) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  // Local mirror so the dialog reflects each edit immediately (every change is
  // persisted as it happens).
  const [partyNumber, setPartyNumber] = useState(
    participant.party_number != null ? String(participant.party_number) : ""
  );
  const [role, setRole] = useState(participant.parliament_role || "mp");
  const [ministry, setMinistry] = useState(participant.ministry || "");
  const [committee, setCommittee] = useState(participant.committee_name || "");
  const [constituency, setConstituency] = useState(
    participant.constituency_name || ""
  );

  async function persist(
    field:
      | "party_number"
      | "parliament_role"
      | "ministry"
      | "committee_name"
      | "constituency_name",
    value: string | null
  ) {
    setSaving(true);
    await onSave(participant.id, field, value);
    setSaving(false);
  }

  const isMinisterRole =
    role === "cabinet_minister" || role === "shadow_minister";

  const sortedParties = [...parties]
    .filter((p) => p.party_number != null)
    .sort((a, b) => (a.party_number ?? 0) - (b.party_number ?? 0));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>{participant.full_name}</DialogDescription>
        </DialogHeader>

        {saving && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="size-4 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Saving...</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Party — the actual party; the side (Ruling/Opposition) follows it */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Party
            </label>
            <select
              value={partyNumber}
              onChange={(e) => {
                const v = e.target.value;
                setPartyNumber(v);
                void persist("party_number", v || null);
              }}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">-- None --</option>
              {sortedParties.map((pt) => (
                <option key={pt.party_number} value={String(pt.party_number)}>
                  {pt.name}
                </option>
              ))}
            </select>
            {sortedParties.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No parties set up yet — add them on the Parties page.
              </p>
            )}
          </div>

          {/* Constituency */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Constituency
            </label>
            <input
              type="text"
              value={constituency}
              onChange={(e) => setConstituency(e.target.value)}
              onBlur={() => {
                const next = constituency.trim();
                if (next !== (participant.constituency_name || "")) {
                  void persist("constituency_name", next || null);
                }
              }}
              placeholder="e.g. Gandhinagar"
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Parliament Role */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => {
                const v = e.target.value;
                setRole(v);
                if (v !== "cabinet_minister" && v !== "shadow_minister") {
                  setMinistry("");
                }
                void persist("parliament_role", v || null);
              }}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {PARLIAMENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </div>

          {/* Ministry (only for minister roles) */}
          {isMinisterRole && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Ministry
              </label>
              <select
                value={ministry}
                onChange={(e) => {
                  const v = e.target.value;
                  setMinistry(v);
                  void persist("ministry", v || null);
                }}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">-- None --</option>
                {MINISTRIES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Committee */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Committee
            </label>
            <select
              value={committee}
              onChange={(e) => {
                const v = e.target.value;
                setCommittee(v);
                void persist("committee_name", v || null);
              }}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">-- None --</option>
              {committeeNames.map((name, index) => (
                <option key={name} value={name}>
                  Committee {index + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
