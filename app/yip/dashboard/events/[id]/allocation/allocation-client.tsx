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
  // OFF by default → new events do NOT pre-assign party sides/leadership; the
  // engine only writes side-neutral constituencies + committees and students
  // form parties + pick leadership live on event day. Check it to restore the
  // full auto-allocation behaviour.
  const [autoFormParties, setAutoFormParties] = useState(true);
  // Parliament roles + ministries are OPTIONAL (off by default): the chapter
  // ticks this to also auto-assign PM / Deputy PM / LoP / Ministers / Speaker
  // candidates. Off → everyone is a plain MP and the chapter assigns leaders.
  const [assignRoles, setAssignRoles] = useState(false);

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
      return { name, members, rulingMembers, oppositionMembers };
    });
  }, [participants, committeeNames]);

  // ── Handlers ──────────────────────────────────────────────────────

  async function handleRunAllocation(autoForm: boolean, withRoles: boolean) {
    setLoading(true);
    const result = await runAllocationAction(eventId, {
      assignSides: autoForm,
      assignRoles: withRoles,
    });
    if (result.success) {
      toast.success(
        !autoForm
          ? "Constituencies assigned — benches left blank for the day"
          : withRoles
            ? "Allocation completed — benches, constituencies & roles assigned"
            : "Benches & constituencies assigned — roles left for you to assign"
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

  // ── No Participants State ─────────────────────────────────────────

  if (participants.length === 0) {
    return (
      <Card className="py-16">
        <CardContent className="flex flex-col items-center text-center">
          <Users className="mb-4 size-12 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">
            No Participants Yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Add participants first before running the allocation engine.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Not Yet Allocated State ───────────────────────────────────────

  if (!hasAllocation) {
    // Parties only need to exist when AUTO-forming. With auto-form OFF (the
    // default) the benches are left blank for students to form on event day and
    // only the side-neutral constituencies + committees are assigned — so no
    // parties are required up front.
    const partiesReady = rulingPartyCount > 0 && oppositionPartyCount > 0;
    const needsParties = autoFormParties && !partiesReady;

    return (
      <div className="space-y-4">
        <Card className="py-16">
          <CardContent className="flex flex-col items-center text-center">
            <Shuffle className="mb-4 size-12 text-[#FF9933]" />
            <h3 className="text-lg font-semibold text-gray-700">
              Ready to Allocate
            </h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              {participants.length} participants registered
              {autoFormParties
                ? ` across ${rulingPartyCount} ruling + ${oppositionPartyCount} opposition parties. `
                : ". "}
              {autoFormParties
                ? assignRoles
                  ? "Benches, constituencies, committees AND Parliament roles (PM, LoP, Ministers, Speaker candidates) will be assigned automatically."
                  : "Party benches, constituencies and committees will be assigned. Parliament roles are left for you to assign."
                : "Constituencies and committees will be assigned; party benches are left blank for students to form on event day."}
            </p>

            <label className="mt-5 flex max-w-md cursor-pointer items-start gap-2 text-left text-sm text-gray-600">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#FF9933]"
                checked={autoFormParties}
                onChange={(e) => setAutoFormParties(e.target.checked)}
              />
              <span>
                <span className="font-medium text-gray-700">
                  Auto-assign party benches (Ruling / Opposition)
                </span>
                <br />
                On by default. Uncheck to leave benches blank so students form
                parties live on the day.
              </span>
            </label>

            <label
              className={`mt-3 flex max-w-md items-start gap-2 text-left text-sm ${
                autoFormParties
                  ? "cursor-pointer text-gray-600"
                  : "cursor-not-allowed text-gray-300"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#FF9933]"
                checked={assignRoles}
                disabled={!autoFormParties}
                onChange={(e) => setAssignRoles(e.target.checked)}
              />
              <span>
                <span className="font-medium">
                  Also auto-assign Parliament roles &amp; Ministries
                </span>
                <br />
                PM, Deputy PM, Leader of Opposition, Cabinet &amp; Shadow
                Ministers, Speaker candidates. Optional — leave off to assign
                these yourself. (Party leaders are set at Form Parties.)
              </span>
            </label>

            {needsParties ? (
              <div className="mt-6 flex flex-col items-center">
                <p className="max-w-md text-sm text-amber-700">
                  Auto-forming needs at least one party on each bench.
                  Currently: {rulingPartyCount} ruling, {oppositionPartyCount}{" "}
                  opposition.
                </p>
                <Link
                  href={`/yip/dashboard/events/${eventId}/parties`}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#FF9933] px-4 py-2 text-sm font-medium text-white hover:bg-[#E68A2E]"
                >
                  <Users className="size-4" />
                  Go to Parties
                </Link>
              </div>
            ) : (
              <Button
                className="mt-6 bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                onClick={() => handleRunAllocation(autoFormParties, assignRoles)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Shuffle className="size-4" />
                )}
                {loading ? "Running Allocation..." : "Run Allocation"}
              </Button>
            )}
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

      {/* Section 1: Party Breakdown */}
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
          <div className="mt-3 space-y-1">
            {/* Show schools in ruling */}
            {(() => {
              const schools = new Map<string, number>();
              ruling.forEach((p) => {
                schools.set(p.school_name, (schools.get(p.school_name) || 0) + 1);
              });
              return [...schools.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([school, count]) => (
                  <div key={school} className="flex justify-between text-xs text-blue-800">
                    <span className="truncate">{school}</span>
                    <span className="ml-2 shrink-0 font-medium">{count}</span>
                  </div>
                ));
            })()}
          </div>
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
          <div className="mt-3 space-y-1">
            {(() => {
              const schools = new Map<string, number>();
              opposition.forEach((p) => {
                schools.set(p.school_name, (schools.get(p.school_name) || 0) + 1);
              });
              return [...schools.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([school, count]) => (
                  <div key={school} className="flex justify-between text-xs text-red-800">
                    <span className="truncate">{school}</span>
                    <span className="ml-2 shrink-0 font-medium">{count}</span>
                  </div>
                ));
            })()}
          </div>
        </div>
      </div>

      {/* Section 2: Leadership Roles */}
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
                <TableHead>School</TableHead>
                <TableHead>Class</TableHead>
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
                    {committee.name}
                  </h4>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {committee.members.length}
                  </Badge>
                </div>
                <div className="mt-1 flex gap-3 text-xs text-gray-500">
                  <span className="text-blue-600">
                    Ruling: {committee.rulingMembers.length}
                  </span>
                  <span className="text-red-600">
                    Opp: {committee.oppositionMembers.length}
                  </span>
                </div>
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
                        <span
                          className={`inline-block size-2 rounded-full ${
                            m.party_side === "ruling" ? "bg-blue-500" : "bg-red-500"
                          }`}
                        />
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
                          {pt.side === "ruling"
                            ? "Ruling"
                            : pt.side === "opposition"
                            ? "Opposition"
                            : ""}{" "}
                          · {members.length}
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
                <TableHead>Side</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Constituency</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead className="w-16">Com. #</TableHead>
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
                  <TableCell>
                    {p.party_side ? (
                      <Badge
                        variant="secondary"
                        className={
                          PARTY_COLORS[p.party_side as keyof typeof PARTY_COLORS]
                            ?.badge ?? "bg-gray-100 text-gray-700"
                        }
                      >
                        {p.party_side === "ruling" ? "Ruling" : "Opposition"}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </TableCell>
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
                    {p.constituency_name || "--"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {p.constituency_state || "--"}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">
                    {p.committee_name || "--"}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {p.committee_number ?? <span className="text-gray-300">—</span>}
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
              onClick={() => handleRunAllocation(autoFormParties, assignRoles)}
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
      <TableCell className="text-xs text-gray-600">
        {participant.school_name}
      </TableCell>
      <TableCell>{participant.class}</TableCell>
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
          <DialogDescription>
            {participant.full_name} - {participant.school_name}
          </DialogDescription>
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
                  {pt.side
                    ? ` (${pt.side === "ruling" ? "Ruling" : "Opposition"})`
                    : ""}
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
              {committeeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
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
