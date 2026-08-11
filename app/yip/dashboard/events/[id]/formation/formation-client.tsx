"use client";

/**
 * Online House Formation — organiser client. Ordered 7-step checklist:
 * allocation → speaker → party leaders → PM → LoP → appointments → lock.
 *
 * Election steps open a time-windowed remote ballot (participants vote from
 * home on /yip/me/vote); each open step shows a live turnout bar, a window
 * editor (+extend), reminder sends with quota surfacing, and a runoff banner
 * when closing hits a tie.
 *
 * Server work is stubbed behind ./_stubs until Lanes A/B merge — see the
 * banner there. Existing vote-machinery actions (getEventParties,
 * getPartyMembers, openRunoff) are imported for real: they already ship.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Crown,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ScrollText,
  Search,
  Shuffle,
  Users,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/yip/utils";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";
import type { MinistryPortfolio } from "@/lib/yip/cabinet";
// Existing, already-shipped vote machinery — real imports, reused untouched.
import {
  getEventParties,
  getPartyMembers,
  type PartyLite,
  type VoteCandidate,
} from "@/app/yip/actions/voting";
import {
  FORMATION_STEPS,
  type FormationState,
  type FormationStepKey,
  type FormationStepRow,
  type FormationTurnout,
} from "@/lib/yip/formation";
import {
  closeFormationStep,
  extendFormationStep,
  getFormationState,
  getFormationTurnout,
  lockFormation,
  openFormationRunoff,
  openFormationStep,
  runFormationAllocation,
} from "@/app/yip/actions/formation";
import { sendFormationReminders } from "@/app/yip/actions/formation-emails";
import type { FormationEmailSendPlan as FormationInvitePlan } from "@/lib/yip/formation-email-types";

// A step's unresolved tie: the revealed ballot(s) whose top candidates
// finished level (party-leader steps can tie in several parties at once).
type FormationTie = { sessionIds: string[] };
import { InvitePanel } from "./invite-panel";
import { AppointmentsPanel } from "./appointments-panel";

// ─── Helpers ────────────────────────────────────────────────────

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** datetime-local input value → ISO string (null when empty/invalid). */
function localToIso(local: string): string | null {
  if (!local) return null;
  const t = Date.parse(local);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

const STEP_ICONS: Record<FormationStepKey, typeof Vote> = {
  allocation: Shuffle,
  speaker_ballot: Crown,
  party_leader_ballots: Vote,
  pm_ballot: Vote,
  lop_ballot: Vote,
  appointments: Users,
  lock: Lock,
};

function statusBadge(status: string) {
  if (status === "open")
    return (
      <Badge className="animate-pulse bg-green-100 text-green-700">
        Voting open
      </Badge>
    );
  if (status === "closed")
    return <Badge className="bg-blue-100 text-blue-700">Done</Badge>;
  if (status === "locked")
    return <Badge className="bg-[#1a1a3e] text-white">Locked</Badge>;
  return <Badge className="bg-gray-100 text-gray-500">Not started</Badge>;
}

// ─── Component ──────────────────────────────────────────────────

interface FormationClientProps {
  eventId: string;
  eventName: string;
  day1Date: string | null;
  ministries: MinistryPortfolio[];
  initialState: FormationState | null;
  initialError: string | null;
  invitePlan: FormationInvitePlan | null;
  invitePlanError: string | null;
}

export function FormationClient({
  eventId,
  eventName,
  day1Date,
  ministries,
  initialState,
  initialError,
  invitePlan,
  invitePlanError,
}: FormationClientProps) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormationState | null>(initialState);
  const [stateError, setStateError] = useState<string | null>(initialError);

  // Which step cards are expanded. Default: the first non-closed step.
  const [expanded, setExpanded] = useState<Partial<Record<FormationStepKey, boolean>>>(
    () => {
      const rows = initialState?.steps ?? [];
      const active =
        FORMATION_STEPS.find((d) => {
          const row = rows.find((r) => r.step_key === d.key);
          return !row || row.status === "pending" || row.status === "open";
        })?.key ?? "allocation";
      return { [active]: true };
    }
  );

  // Last close attempt's tie, per step — drives the runoff banner.
  const [tieByStep, setTieByStep] = useState<
    Partial<Record<FormationStepKey, FormationTie>>
  >({});

  // Allocation config.
  const [partyCount, setPartyCount] = useState(4);

  // Ballot dialog (open an election step: window + nominees).
  const [ballotDialog, setBallotDialog] = useState<{
    open: boolean;
    stepKey: FormationStepKey | null;
    closesAtLocal: string;
    groups: { party: PartyLite; members: VoteCandidate[] }[];
    selectedIds: string[];
    loading: boolean;
  }>({
    open: false,
    stepKey: null,
    closesAtLocal: "",
    groups: [],
    selectedIds: [],
    loading: false,
  });
  const [nomineeSearch, setNomineeSearch] = useState("");

  // Per-step extend input (datetime-local).
  const [extendLocal, setExtendLocal] = useState<
    Partial<Record<FormationStepKey, string>>
  >({});

  // Runoff banner's "new deadline" input, per step.
  const [runoffLocal, setRunoffLocal] = useState<
    Partial<Record<FormationStepKey, string>>
  >({});

  // Generic confirm dialog (vote-manager idiom).
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });

  const refresh = useCallback(async () => {
    const res = await getFormationState(eventId);
    if (res.success) {
      setState(res.data);
      setStateError(null);
    } else {
      setStateError(res.error);
    }
  }, [eventId]);

  const stepRow = useCallback(
    (key: FormationStepKey): FormationStepRow | null =>
      state?.steps.find((s) => s.step_key === key) ?? null,
    [state]
  );

  const prevStepClosed = useCallback(
    (key: FormationStepKey): boolean => {
      const def = FORMATION_STEPS.find((d) => d.key === key);
      if (!def || def.order === 1) return true;
      const prevDef = FORMATION_STEPS.find((d) => d.order === def.order - 1);
      if (!prevDef) return true;
      const row = stepRow(prevDef.key);
      return row?.status === "closed" || row?.status === "locked";
    },
    [stepRow]
  );

  const doneCount =
    state?.steps.filter((s) => s.status === "closed" || s.status === "locked")
      .length ?? 0;
  const isLocked = state?.steps.some(
    (s) => s.step_key === "lock" && s.status === "locked"
  );

  // ─── Ballot dialog (open an election step) ──────────────────────

  function handleOpenBallotDialog(stepKey: FormationStepKey) {
    setNomineeSearch("");
    setBallotDialog({
      open: true,
      stepKey,
      closesAtLocal: "",
      groups: [],
      selectedIds: [],
      loading: true,
    });
    getEventParties(eventId).then(async (parties) => {
      // PM = ruling bench only; LoP = opposition bench only; speaker + party
      // leaders draw from the whole House (grouped by party).
      const pool =
        stepKey === "pm_ballot"
          ? parties.filter((p) => p.side === "ruling")
          : stepKey === "lop_ballot"
            ? parties.filter((p) => p.side === "opposition")
            : parties;
      const lists = await Promise.all(
        pool.map((p) => getPartyMembers(eventId, p.id))
      );
      const groups = pool
        .map((party, i) => ({ party, members: lists[i] ?? [] }))
        .filter((g) => g.members.length > 0);
      setBallotDialog((prev) =>
        prev.open && prev.stepKey === stepKey
          ? { ...prev, groups, loading: false }
          : prev
      );
    });
  }

  function toggleNominee(id: string) {
    setBallotDialog((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((x) => x !== id)
        : [...prev.selectedIds, id],
    }));
  }

  function filterNominees(members: VoteCandidate[]) {
    const q = nomineeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.constituency_name ?? "").toLowerCase().includes(q) ||
        (m.constituency_number != null &&
          String(m.constituency_number).includes(q))
    );
  }

  // Per-step nomination validity (server re-validates authoritatively).
  function ballotValidity(): { ok: boolean; hint: string } {
    const key = ballotDialog.stepKey;
    const picked = ballotDialog.selectedIds.length;
    const iso = localToIso(ballotDialog.closesAtLocal);
    if (!iso) return { ok: false, hint: "Set a closing date & time." };
    if (Date.parse(iso) <= Date.now())
      return { ok: false, hint: "The window must close in the future." };
    if (day1Date && Date.parse(iso) >= Date.parse(day1Date))
      return {
        ok: false,
        hint: "The window must close before event Day 1.",
      };
    if (key === "speaker_ballot") {
      return picked >= 2
        ? { ok: true, hint: `${picked} nominated` }
        : { ok: false, hint: "Nominate at least 2 candidates." };
    }
    if (key === "party_leader_ballots") {
      // Every party with ≥2 members needs ≥2 nominees (its own ballot).
      const short = ballotDialog.groups.filter(
        (g) =>
          g.members.length >= 2 &&
          g.members.filter((m) => ballotDialog.selectedIds.includes(m.id))
            .length < 2
      );
      return short.length === 0
        ? { ok: true, hint: `${picked} nominated across parties` }
        : {
            ok: false,
            hint: `Pick at least 2 nominees in: ${short
              .map((g) => g.party.name)
              .join(", ")}`,
          };
    }
    // pm_ballot / lop_ballot — bench seat, 2–5 nominees (vote-manager idiom).
    if (picked < 2) return { ok: false, hint: "Nominate at least 2." };
    if (picked > 5) return { ok: false, hint: "At most 5 nominees." };
    return { ok: true, hint: `${picked} nominated` };
  }

  function handleOpenStep() {
    const key = ballotDialog.stepKey;
    if (!key) return;
    const closesAt = localToIso(ballotDialog.closesAtLocal);
    if (!closesAt) return;
    const candidateIds = ballotDialog.selectedIds;
    startTransition(async () => {
      const res = await openFormationStep(eventId, key, {
        closesAt,
        candidateIds,
      });
      if (res.success) {
        toast.success("Ballot is open — participants can now vote remotely.");
        setBallotDialog((p) => ({ ...p, open: false }));
        await refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // ─── Step actions ───────────────────────────────────────────────

  function handleRunAllocation() {
    setConfirmDialog({
      open: true,
      title: "Run random allocation",
      description: `Randomly assign benches and form ${partyCount} balanced parties for every participant. Sides (ruling / opposition) are assigned in this same step.`,
      action: () => {
        startTransition(async () => {
          const res = await runFormationAllocation(eventId, { partyCount });
          if (res.success) {
            toast.success("Allocation complete — parties are formed.");
            await refresh();
          } else {
            toast.error(res.error);
          }
          setConfirmDialog((p) => ({ ...p, open: false }));
        });
      },
    });
  }

  function handleExtend(key: FormationStepKey) {
    const iso = localToIso(extendLocal[key] ?? "");
    if (!iso) {
      toast.error("Pick a new closing date & time first.");
      return;
    }
    startTransition(async () => {
      const res = await extendFormationStep(eventId, key, iso);
      if (res.success) {
        toast.success(`Window extended to ${fmtWhen(iso)}.`);
        setExtendLocal((p) => ({ ...p, [key]: "" }));
        await refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleSendReminders(key: FormationStepKey) {
    startTransition(async () => {
      const res = await sendFormationReminders(eventId, key);
      if (res.success) {
        const { quota, results } = res.data;
        const sent = results.filter((r) => r.success).length;
        const failed = results.length - sent;
        // Quota-result surfacing (plan §5.1): always show today's usage.
        toast.success(
          `Reminders sent to ${sent} participant${sent === 1 ? "" : "s"}` +
            (failed > 0 ? ` · ${failed} failed` : "") +
            ` · ${quota.sentToday}/${quota.dailyCap} emails used today`
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCloseStep(key: FormationStepKey, label: string) {
    setConfirmDialog({
      open: true,
      title: `Close ${label}`,
      description:
        "Stop accepting votes, count the ballots, and record the winners. On a tie you'll be offered a runoff.",
      action: () => {
        startTransition(async () => {
          const res = await closeFormationStep(eventId, key);
          if (res.success) {
            if (!res.data.tie) {
              toast.success(`${label} complete — winners recorded.`);
              setTieByStep((p) => ({ ...p, [key]: undefined }));
            } else {
              setTieByStep((p) => ({
                ...p,
                [key]: { sessionIds: res.data.tiedSessionIds },
              }));
              toast.warning("Tie — open a runoff to break it.");
            }
            await refresh();
          } else {
            toast.error(res.error);
          }
          setConfirmDialog((p) => ({ ...p, open: false }));
        });
      },
    });
  }

  // Runoff: openFormationRunoff restricts the fresh ballot to only the tied
  // candidates, stamps the new deadline into its config, appends it to the
  // step's session_ids, and archives the revealed tie tally. Party-leader
  // steps can tie in several parties at once — one runoff per tied ballot,
  // all on the same deadline.
  function handleOpenRunoff(key: FormationStepKey, tie: FormationTie) {
    const iso = localToIso(runoffLocal[key] ?? "");
    if (!iso) {
      toast.error("Pick a closing time for the runoff first.");
      return;
    }
    startTransition(async () => {
      for (const sessionId of tie.sessionIds) {
        const res = await openFormationRunoff(eventId, key, sessionId, iso);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
      }
      toast.success(
        "Runoff open — only the tied candidates are on the ballot."
      );
      setTieByStep((p) => ({ ...p, [key]: undefined }));
      setRunoffLocal((p) => ({ ...p, [key]: "" }));
      await refresh();
    });
  }

  function handleLock() {
    setConfirmDialog({
      open: true,
      title: "Lock the House",
      description:
        "Freeze allocation, parties, and every elected & appointed role. This is the final step — the House arrives on event day fully formed. Locking refuses while any ballot is still open.",
      action: () => {
        startTransition(async () => {
          const res = await lockFormation(eventId);
          if (res.success) {
            toast.success("The House is locked and ready for event day.");
            await refresh();
          } else {
            toast.error(res.error);
          }
          setConfirmDialog((p) => ({ ...p, open: false }));
        });
      },
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  const validity = ballotValidity();
  const ballotDef = FORMATION_STEPS.find((d) => d.key === ballotDialog.stepKey);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            Before the Event · Regional Round
          </p>
          <h2
            className="mt-0.5 text-xl font-bold tracking-tight"
            style={{ ...SERIF, color: INK }}
          >
            Online House Formation
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#1a1a3e]/60">
            Form the House before {eventName} begins: allocate benches, then
            run each election as a time-windowed remote ballot — participants
            vote from home with their access code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]">
            {doneCount} / {FORMATION_STEPS.length} steps done
          </Badge>
          <Link
            href={`/yip/dashboard/events/${eventId}/formation/announcement`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a1a3e]/10 bg-white px-3 py-1.5 text-sm font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5"
          >
            <ScrollText className="size-4 text-[#FF9933]" />
            Oath Announcement
          </Link>
        </div>
      </div>

      {/* Engine-not-wired / load error notice */}
      {stateError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Formation engine unavailable: {stateError}
        </div>
      )}

      {/* Step checklist */}
      <div className="space-y-3">
        {FORMATION_STEPS.map((def) => {
          const row = stepRow(def.key);
          const status = row?.status ?? "pending";
          const isOpen = status === "open";
          const isDone = status === "closed" || status === "locked";
          const canStart = prevStepClosed(def.key) && status === "pending";
          const tie = tieByStep[def.key];
          const Icon = STEP_ICONS[def.key];
          const isExpanded = expanded[def.key] ?? false;
          const summary = state?.turnout[def.key];

          return (
            <Card key={def.key} className={cn(isOpen && "border-green-300")}>
              <CardHeader className="pb-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((p) => ({ ...p, [def.key]: !isExpanded }))
                  }
                  className="flex w-full items-center gap-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 shrink-0 text-[#1a1a3e]/40" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-[#1a1a3e]/40" />
                  )}
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      isDone
                        ? "bg-[#138808]/10 text-[#138808]"
                        : isOpen
                          ? "bg-green-100 text-green-700"
                          : "bg-[#1a1a3e]/5 text-[#1a1a3e]/50"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-4" /> : def.order}
                  </span>
                  <CardTitle
                    className="flex flex-1 items-center gap-2 text-sm"
                    style={{ ...SERIF, color: INK }}
                  >
                    <Icon className="size-4 text-[#FF9933]" />
                    {def.label}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isOpen && row?.closes_at && (
                      <span className="hidden items-center gap-1 text-xs text-[#1a1a3e]/50 sm:flex">
                        <Clock className="size-3.5" />
                        closes {fmtWhen(row.closes_at)}
                      </span>
                    )}
                    {statusBadge(status)}
                  </div>
                </button>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4 pl-[4.25rem]">
                  {/* Window summary for done election steps */}
                  {isDone && def.mode === "election" && (
                    <p className="text-xs text-[#1a1a3e]/50">
                      Ran {fmtWhen(row?.opens_at)} → {fmtWhen(row?.closes_at)}
                      {summary &&
                        ` · ${summary.voted}/${summary.eligible} voted`}
                    </p>
                  )}

                  {/* ── Allocation (organiser step 1) ── */}
                  {def.key === "allocation" && !isDone && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="formation-party-count" className="text-xs">
                          Number of parties
                        </Label>
                        <Input
                          id="formation-party-count"
                          type="number"
                          min={2}
                          max={10}
                          value={partyCount}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setPartyCount(
                              Number.isFinite(n) ? Math.min(10, Math.max(2, n)) : 4
                            );
                          }}
                          className="h-9 w-24"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={handleRunAllocation}
                      >
                        <Shuffle className="mr-1.5 size-3.5" />
                        Run allocation & form parties
                      </Button>
                      <p className="basis-full text-xs text-[#1a1a3e]/50">
                        Random, school-spread, bench-balanced. Sides (ruling /
                        opposition) are assigned here too.
                      </p>
                    </div>
                  )}
                  {def.key === "allocation" && isDone && (
                    <p className="text-sm text-[#1a1a3e]/70">
                      Benches assigned and parties formed. Manage them on the{" "}
                      <Link
                        href={`/yip/dashboard/events/${eventId}/parties`}
                        className="font-medium text-[#138808] hover:underline"
                      >
                        Parties
                      </Link>{" "}
                      tab.
                    </p>
                  )}

                  {/* ── Election steps ── */}
                  {def.mode === "election" && status === "pending" && (
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        disabled={isPending || !canStart}
                        onClick={() => handleOpenBallotDialog(def.key)}
                      >
                        <Vote className="mr-1.5 size-3.5" />
                        Open ballot…
                      </Button>
                      {!canStart && (
                        <p className="text-xs text-[#1a1a3e]/50">
                          Finish the previous step first.
                        </p>
                      )}
                    </div>
                  )}

                  {def.mode === "election" && isOpen && (
                    <div className="space-y-4">
                      <TurnoutBlock eventId={eventId} stepKey={def.key} />

                      {/* Window editor: extend */}
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`extend-${def.key}`}
                            className="text-xs"
                          >
                            Extend window until
                          </Label>
                          <Input
                            id={`extend-${def.key}`}
                            type="datetime-local"
                            value={extendLocal[def.key] ?? ""}
                            onChange={(e) =>
                              setExtendLocal((p) => ({
                                ...p,
                                [def.key]: e.target.value,
                              }))
                            }
                            className="h-9 w-56"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending || !extendLocal[def.key]}
                          onClick={() => handleExtend(def.key)}
                        >
                          <Clock className="mr-1.5 size-3.5" />
                          Extend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleSendReminders(def.key)}
                        >
                          <Mail className="mr-1.5 size-3.5" />
                          Send reminder
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => handleCloseStep(def.key, def.label)}
                        >
                          Close & count
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Runoff banner on tie */}
                  {def.mode === "election" && tie && (
                    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">
                        Tie — the leading candidates finished on equal votes
                        {tie.sessionIds.length > 1
                          ? ` in ${tie.sessionIds.length} ballots`
                          : ""}
                        . Open a runoff between only the tied candidates.
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`runoff-${def.key}`}
                            className="text-xs"
                          >
                            Runoff closes at
                          </Label>
                          <Input
                            id={`runoff-${def.key}`}
                            type="datetime-local"
                            value={runoffLocal[def.key] ?? ""}
                            onChange={(e) =>
                              setRunoffLocal((p) => ({
                                ...p,
                                [def.key]: e.target.value,
                              }))
                            }
                            className="h-9 w-56"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={isPending || !runoffLocal[def.key]}
                          onClick={() => handleOpenRunoff(def.key, tie)}
                        >
                          Open runoff
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Appointments (organiser step 6) ── */}
                  {def.key === "appointments" && (
                    <div className="space-y-4">
                      <AppointmentsPanel
                        eventId={eventId}
                        ministries={ministries}
                        disabled={Boolean(isLocked)}
                      />
                      {!isDone && (
                        <Button
                          size="sm"
                          disabled={isPending || !prevStepClosed("appointments")}
                          onClick={() =>
                            handleCloseStep("appointments", def.label)
                          }
                        >
                          <CheckCircle2 className="mr-1.5 size-3.5" />
                          Mark appointments complete
                        </Button>
                      )}
                    </div>
                  )}

                  {/* ── Lock (organiser step 7) ── */}
                  {def.key === "lock" && (
                    <div className="space-y-2">
                      {status === "locked" ? (
                        <p className="flex items-center gap-2 text-sm font-medium text-[#138808]">
                          <Lock className="size-4" />
                          The House is locked — ready for event day.
                        </p>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={isPending || !prevStepClosed("lock")}
                            onClick={handleLock}
                          >
                            <Lock className="mr-1.5 size-3.5" />
                            Lock the House
                          </Button>
                          <p className="text-xs text-[#1a1a3e]/50">
                            Refuses while any formation ballot is still open or
                            uncounted.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Invites & access codes */}
      <InvitePanel
        eventId={eventId}
        plan={invitePlan}
        planError={invitePlanError}
      />

      {/* ── Ballot dialog: window + nominee picker ── */}
      <Dialog
        open={ballotDialog.open}
        onOpenChange={(open) =>
          setBallotDialog((p) =>
            open
              ? { ...p, open }
              : {
                  open: false,
                  stepKey: null,
                  closesAtLocal: "",
                  groups: [],
                  selectedIds: [],
                  loading: false,
                }
          )
        }
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {ballotDef ? `Open ${ballotDef.label}` : "Open ballot"}
            </DialogTitle>
            <DialogDescription>
              {ballotDialog.stepKey === "party_leader_ballots"
                ? "Every party's ballot opens at once — each member sees only their own party's nominees. Pick at least 2 nominees per party."
                : ballotDialog.stepKey === "pm_ballot"
                  ? "Nominate 2–5 from the ruling bench. Only the ruling bench votes."
                  : ballotDialog.stepKey === "lop_ballot"
                    ? "Nominate 2–5 from the opposition bench. Only the opposition bench votes."
                    : "Nominate at least 2 from anywhere in the House. The whole House votes; the runner-up becomes Deputy Speaker."}{" "}
              Participants vote remotely until the window closes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="ballot-closes-at" className="text-xs">
              Voting window closes at
            </Label>
            <Input
              id="ballot-closes-at"
              type="datetime-local"
              value={ballotDialog.closesAtLocal}
              onChange={(e) =>
                setBallotDialog((p) => ({ ...p, closesAtLocal: e.target.value }))
              }
              className="h-9 w-64"
            />
            {day1Date && (
              <p className="text-[11px] text-[#1a1a3e]/40">
                Must close before Day 1 (
                {new Date(day1Date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
                ).
              </p>
            )}
          </div>

          {ballotDialog.groups.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={nomineeSearch}
                onChange={(e) => setNomineeSearch(e.target.value)}
                placeholder="Search by name, constituency or No."
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}

          {ballotDialog.loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading members...
            </div>
          ) : ballotDialog.groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members available — run the allocation step first.
            </p>
          ) : (
            <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {ballotDialog.groups.map((g) => {
                const visible = filterNominees(g.members);
                if (visible.length === 0) return null;
                const picks = g.members.filter((m) =>
                  ballotDialog.selectedIds.includes(m.id)
                ).length;
                return (
                  <div key={g.party.id} className="space-y-1.5">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-popover/95 py-1 backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {g.party.name}
                        {g.party.side && (
                          <span className="ml-1 font-normal normal-case text-gray-400">
                            · {g.party.side}
                          </span>
                        )}
                      </p>
                      <span className="text-[11px] text-gray-400">
                        {picks} nominated
                      </span>
                    </div>
                    {visible.map((m) => {
                      const checked = ballotDialog.selectedIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleNominee(m.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border-2 p-2.5 text-left transition-all",
                            checked
                              ? "border-[#FF9933] bg-[#FF9933]/5"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {m.full_name}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {m.constituency_name
                                ? m.constituency_number != null
                                  ? `#${m.constituency_number} · ${m.constituency_name}`
                                  : m.constituency_name
                                : ""}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "ml-2 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                              checked
                                ? "border-[#FF9933] bg-[#FF9933]"
                                : "border-gray-300 bg-white"
                            )}
                          >
                            {checked && (
                              <CheckCircle2 className="size-3.5 text-white" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <span className="mr-auto self-center text-xs text-muted-foreground">
              {validity.hint}
            </span>
            <Button
              variant="outline"
              onClick={() =>
                setBallotDialog({
                  open: false,
                  stepKey: null,
                  closesAtLocal: "",
                  groups: [],
                  selectedIds: [],
                  loading: false,
                })
              }
            >
              Cancel
            </Button>
            <Button
              disabled={isPending || !validity.ok}
              onClick={handleOpenStep}
            >
              {isPending ? "Opening..." : "Open ballot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog((p) => ({ ...p, open: false }))}
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={confirmDialog.action}>
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Turnout block (per open election step) ─────────────────────

function TurnoutBlock({
  eventId,
  stepKey,
}: {
  eventId: string;
  stepKey: FormationStepKey;
}) {
  const [turnout, setTurnout] = useState<FormationTurnout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getFormationTurnout(eventId, stepKey);
    setLoading(false);
    if (res.success) {
      setTurnout(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [eventId, stepKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <p className="text-xs text-amber-700">Turnout unavailable: {error}</p>
    );
  }
  if (!turnout) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading turnout…
      </p>
    );
  }

  const pct =
    turnout.eligible > 0
      ? Math.min((turnout.voted / turnout.eligible) * 100, 100)
      : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3.5" />
          Turnout
        </span>
        <span className="flex items-center gap-2 font-semibold tabular-nums">
          {turnout.voted}{" "}
          <span className="font-normal text-muted-foreground">
            / {turnout.eligible}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh turnout"
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {turnout.pendingParticipants.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setPendingOpen((o) => !o)}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800"
          >
            {pendingOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {turnout.pendingParticipants.length} yet to vote
          </button>
          {pendingOpen && (
            <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-gray-600">
              {turnout.pendingParticipants.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Circle className="size-2 shrink-0 text-gray-300" />
                  <span className="truncate">{p.full_name}</span>
                  {p.emailMasked && (
                    <span className="shrink-0 text-gray-400">
                      {p.emailMasked}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
