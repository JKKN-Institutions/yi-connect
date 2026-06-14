"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
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
import {
  Vote,
  CheckCircle2,
  XCircle,
  Eye,
  StopCircle,
  Users,
  BarChart3,
  Crown,
  Landmark,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Label } from "@/components/yip/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/yip/ui/select";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { useVoteSession } from "@/lib/yip/hooks/use-vote-session";
import {
  openVote,
  closeVote,
  revealResults,
  openRunoff,
  getSpeakerCandidates,
  getVoteCandidates,
  getEventBills,
  getEventParties,
  getPartyMembers,
  type VoteCandidate,
  type PartyLite,
} from "@/app/yip/actions/voting";
import {
  computeElectionOutcome,
  computeDeputyRunoffOutcome,
} from "@/lib/yip/election-outcome";
import {
  getFloorPanel,
  castFloorVote,
  correctFloorVote,
  type FloorPanel,
  type FloorPendingParticipant,
  type FloorManualEntry,
} from "@/app/yip/actions/vote-floor";
import type { Tables } from "@/types/yip/database";

// ─── Types ──────────────────────────────────────────────────────

type AgendaItem = Tables<{ schema: "yip" }, "agenda">;

interface VoteManagerProps {
  eventId: string;
  currentAgendaItem: AgendaItem | null;
  totalParticipants: number;
}

interface BillOption {
  id: string;
  title: string;
  objective: string | null;
  party_side: string;
  status: string | null;
}

// ─── Component ──────────────────────────────────────────────────

export function VoteManager({
  eventId,
  currentAgendaItem,
  totalParticipants,
}: VoteManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState<VoteCandidate[]>([]);
  const [bills, setBills] = useState<BillOption[]>([]);
  const [parties, setParties] = useState<PartyLite[]>([]);
  // Party-leader nomination dialog: the party being elected for, its members,
  // and the organiser's 3–5 chosen nominees.
  const [leaderDialog, setLeaderDialog] = useState<{
    open: boolean;
    party: PartyLite | null;
    members: VoteCandidate[];
    selectedIds: string[];
    loading: boolean;
  }>({ open: false, party: null, members: [], selectedIds: [], loading: false });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });

  // Get realtime vote session state with live counts
  const {
    session: voteSession,
    isOpen,
    isClosed,
    isRevealed,
    tallies,
    totalVotes,
  } = useVoteSession(eventId, { trackVotes: true });

  const agendaType = currentAgendaItem?.agenda_type;
  // Party-leader elections are not tied to one agenda_type — the organiser can
  // hold them whenever an agenda item is live. Voting + bill controls still gate
  // on their agenda types.
  const showVoteControls =
    agendaType === "speaker_election" ||
    agendaType === "bill_presentation" ||
    Boolean(currentAgendaItem);

  // The active party-leader session's party id (config.partyId), used to label
  // its tally with member names and to name the party in the result block.
  const activeLeaderPartyId =
    voteSession?.vote_type === "party_leader"
      ? ((voteSession.config ?? {}) as { partyId?: string }).partyId ?? null
      : null;

  // Fetch candidates or bills when agenda type warrants it.
  // For speaker elections the ACTIVE session's config.candidateIds is the
  // authoritative ballot — after a round-1 reveal a deputy runoff's tied pair
  // have parliament_role reset to mp, so the role-based lookup would render
  // the wrong roll-call list and leave result names unresolved. Prefer the
  // session config; fall back to roles when no session carries one.
  useEffect(() => {
    if (agendaType === "speaker_election") {
      const cfg =
        voteSession?.vote_type === "speaker_election"
          ? ((voteSession.config ?? {}) as { candidateIds?: unknown })
          : {};
      const ids = Array.isArray(cfg.candidateIds)
        ? cfg.candidateIds.filter((x): x is string => typeof x === "string")
        : [];
      if (ids.length > 0) {
        getVoteCandidates(ids).then(setCandidates);
      } else {
        getSpeakerCandidates(eventId).then(setCandidates);
      }
    }
    if (agendaType === "bill_presentation") {
      getEventBills(eventId).then(setBills);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaType, eventId, voteSession?.id]);

  // Parties are always available to the organiser (party-leader elections can be
  // held during any agenda item).
  useEffect(() => {
    if (currentAgendaItem) {
      getEventParties(eventId).then(setParties);
    }
  }, [currentAgendaItem?.id, eventId]);

  // When a party-leader session is active, load that party's members so the live
  // tally and result block can render candidate names (reuses `candidates`).
  useEffect(() => {
    if (activeLeaderPartyId) {
      getPartyMembers(eventId, activeLeaderPartyId).then(setCandidates);
    }
  }, [activeLeaderPartyId, eventId]);

  // ─── Action handlers ──────────────────────────────────────────

  function handleOpenSpeakerElection() {
    if (!currentAgendaItem) return;

    setConfirmDialog({
      open: true,
      title: "Open Speaker Election",
      description: `Open voting for Speaker election with ${candidates.length} candidates? All participants will be able to cast their vote.`,
      action: () => {
        startTransition(async () => {
          const result = await openVote(
            eventId,
            currentAgendaItem.id,
            "speaker_election",
            { candidateIds: candidates.map((c) => c.id) }
          );
          if (result.success) {
            toast.success("Speaker election voting is now open!");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleOpenBillVote(bill: BillOption) {
    if (!currentAgendaItem) return;

    setConfirmDialog({
      open: true,
      title: "Open Bill Vote",
      description: `Open voting on "${bill.title}"? Participants will vote Aye, Nay, or Abstain.`,
      action: () => {
        startTransition(async () => {
          const result = await openVote(
            eventId,
            currentAgendaItem.id,
            "bill_vote",
            { billId: bill.id }
          );
          if (result.success) {
            toast.success("Bill voting is now open!");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  // Party-leader: open the nomination dialog and load the party's members.
  function handleHoldLeaderElection(party: PartyLite) {
    setLeaderDialog({
      open: true,
      party,
      members: [],
      selectedIds: [],
      loading: true,
    });
    getPartyMembers(eventId, party.id).then((members) => {
      setLeaderDialog((prev) =>
        prev.party?.id === party.id
          ? { ...prev, members, loading: false }
          : prev
      );
    });
  }

  function toggleLeaderNominee(id: string) {
    setLeaderDialog((prev) => {
      const has = prev.selectedIds.includes(id);
      // Cap at 5 nominees; ignore further picks once full.
      if (!has && prev.selectedIds.length >= 5) return prev;
      return {
        ...prev,
        selectedIds: has
          ? prev.selectedIds.filter((x) => x !== id)
          : [...prev.selectedIds, id],
      };
    });
  }

  function handleOpenLeaderElection() {
    if (!currentAgendaItem || !leaderDialog.party) return;
    const party = leaderDialog.party;
    const candidateIds = leaderDialog.selectedIds;
    startTransition(async () => {
      const result = await openVote(
        eventId,
        currentAgendaItem.id,
        "party_leader",
        { candidateIds, partyId: party.id }
      );
      if (result.success) {
        toast.success(`${party.name} leader election is now open!`);
        setLeaderDialog({
          open: false,
          party: null,
          members: [],
          selectedIds: [],
          loading: false,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCloseVoting() {
    if (!voteSession) return;

    setConfirmDialog({
      open: true,
      title: "Close Voting",
      description:
        "Stop accepting votes? Participants who haven't voted yet will not be able to vote.",
      action: () => {
        startTransition(async () => {
          const result = await closeVote(voteSession.id);
          if (result.success) {
            toast.success("Voting closed");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleRevealResults() {
    if (!voteSession) return;

    setConfirmDialog({
      open: true,
      title: "Reveal Results",
      description:
        "Reveal vote results to everyone? This will show results on the projector and participant phones.",
      action: () => {
        startTransition(async () => {
          const result = await revealResults(voteSession.id);
          if (result.success) {
            toast.success("Results revealed!");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleRunoff() {
    if (!voteSession) return;
    setConfirmDialog({
      open: true,
      title: "Open 60-second runoff",
      description:
        "Open a fresh 60-second vote between only the tied candidates to break the tie. Start the timer for 60 seconds once it opens.",
      action: () => {
        startTransition(async () => {
          const result = await openRunoff(voteSession.id);
          if (result.success) {
            toast.success("Runoff opened — only the tied candidates are on the ballot.");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  // ─── Reusable party-leader elements (shared by both render branches) ──

  // The list of parties with a "Hold Election" action. Rendered in the
  // no-session branch and (as "hold the next party's") after a revealed
  // party-leader result, so the organiser can run each party in sequence.
  const partyLeaderList =
    parties.length > 0 ? (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Crown className="size-4 text-[#FF9933]" />
          Party Leader Elections
        </div>
        <p className="text-xs text-gray-500">
          Each party elects its own leader — only that party&apos;s members can
          vote. Hold one election at a time.
        </p>
        <div className="space-y-2">
          {parties.map((party) => (
            <div
              key={party.id}
              className="flex items-center justify-between rounded-lg border bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {party.name}
                </p>
                <p className="text-xs text-gray-500">
                  {party.member_count} member
                  {party.member_count === 1 ? "" : "s"}
                  {party.party_leader_id && (
                    <span className="ml-1 inline-flex items-center gap-1 text-amber-700">
                      · <Crown className="size-3 text-amber-500" />
                      Leader elected
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || party.member_count < 2}
                onClick={() => handleHoldLeaderElection(party)}
              >
                <Vote className="size-3.5 mr-1" />
                {party.party_leader_id ? "Re-elect" : "Hold Election"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  // The nomination dialog (pick 3–5 nominees → open the vote).
  const partyLeaderDialog = (
    <Dialog
      open={leaderDialog.open}
      onOpenChange={(open) =>
        setLeaderDialog((prev) =>
          open
            ? { ...prev, open }
            : {
                open: false,
                party: null,
                members: [],
                selectedIds: [],
                loading: false,
              }
        )
      }
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {leaderDialog.party
              ? `Hold ${leaderDialog.party.name} Leader Election`
              : "Hold Party Leader Election"}
          </DialogTitle>
          <DialogDescription>
            Choose 3–5 nominees from this party. Only this party&apos;s members
            will be able to vote.
          </DialogDescription>
        </DialogHeader>

        {leaderDialog.loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading members...
          </div>
        ) : leaderDialog.members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This party has no members to nominate.
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {leaderDialog.members.map((m) => {
              const checked = leaderDialog.selectedIds.includes(m.id);
              const atCap = !checked && leaderDialog.selectedIds.length >= 5;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={atCap}
                  onClick={() => toggleLeaderNominee(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                    checked
                      ? "border-[#FF9933] bg-[#FF9933]/5"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    atCap && "opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {m.full_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {m.school_name}
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
                    {checked && <CheckCircle2 className="size-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {leaderDialog.selectedIds.length} selected
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setLeaderDialog({
                open: false,
                party: null,
                members: [],
                selectedIds: [],
                loading: false,
              })
            }
          >
            Cancel
          </Button>
          <Button
            disabled={
              isPending ||
              leaderDialog.selectedIds.length < 3 ||
              leaderDialog.selectedIds.length > 5
            }
            onClick={handleOpenLeaderElection}
          >
            {isPending ? "Opening..." : "Open Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── If not a voting agenda type and no active session, don't render ─

  if (!showVoteControls && !voteSession) return null;

  // ─── Active vote session ──────────────────────────────────────

  if (voteSession && (isOpen || isClosed || isRevealed)) {
    const maxVotes = Math.max(...tallies.map((t) => t.count), 1);

    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Vote className="size-4" />
                {voteSession.vote_type === "speaker_election"
                  ? "Speaker Election"
                  : voteSession.vote_type === "party_leader"
                  ? `${
                      parties.find((p) => p.id === activeLeaderPartyId)?.name ??
                      "Party"
                    } Leader Election`
                  : "Bill Vote"}
              </CardTitle>
              <Badge
                variant="secondary"
                className={cn(
                  isOpen && "bg-green-100 text-green-700 animate-pulse",
                  isClosed && "bg-amber-100 text-amber-700",
                  isRevealed && "bg-blue-100 text-blue-700"
                )}
              >
                {isOpen ? "Voting Open" : isClosed ? "Closed" : "Results Revealed"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vote count header */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                Votes Cast
              </span>
              <span className="font-semibold">
                {totalVotes}{" "}
                <span className="font-normal text-muted-foreground">
                  / {totalParticipants}
                </span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] transition-all duration-500"
                style={{
                  width: `${
                    totalParticipants > 0
                      ? Math.min((totalVotes / totalParticipants) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Live Tally Bars */}
            {tallies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BarChart3 className="size-3.5" />
                  {isRevealed ? "Final Results" : "Live Tally (Organizer Only)"}
                </div>
                {tallies.map((tally) => {
                  const percentage =
                    totalVotes > 0
                      ? Math.round((tally.count / totalVotes) * 100)
                      : 0;
                  // Only crown an UNAMBIGUOUS single leader. On a tie (top count
                  // shared by >1 option) the outcome is "tie → runoff", so
                  // highlighting one tied candidate as the winner is wrong.
                  const topCount = tallies[0]?.count ?? 0;
                  const isWinner =
                    isRevealed &&
                    topCount > 0 &&
                    tally.count === topCount &&
                    tallies.filter((t) => t.count === topCount).length === 1;

                  // Determine label and color
                  let label = tally.vote_value;
                  let barColor = "bg-gray-400";

                  if (
                    voteSession.vote_type === "speaker_election" ||
                    voteSession.vote_type === "party_leader"
                  ) {
                    const candidate = candidates.find(
                      (c) => c.id === tally.vote_value
                    );
                    label = candidate?.full_name ?? tally.vote_value;
                    barColor = "bg-[#FF9933]";
                  } else {
                    // Bill vote
                    if (tally.vote_value === "aye") {
                      label = "AYE";
                      barColor = "bg-green-500";
                    } else if (tally.vote_value === "nay") {
                      label = "NAY";
                      barColor = "bg-red-500";
                    } else if (tally.vote_value === "abstain") {
                      label = "ABSTAIN";
                      barColor = "bg-gray-400";
                    }
                  }

                  return (
                    <div key={tally.vote_value} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 font-medium",
                            isWinner
                              ? "text-amber-700"
                              : "text-gray-700"
                          )}
                        >
                          {isWinner && (
                            <Crown className="size-3.5 text-amber-500" />
                          )}
                          {label}
                        </span>
                        <span className="text-sm tabular-nums text-gray-600">
                          {tally.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            barColor,
                            isWinner && "ring-2 ring-amber-300"
                          )}
                          style={{
                            width: `${
                              maxVotes > 0
                                ? (tally.count / maxVotes) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Bill result summary */}
                {isRevealed && voteSession.vote_type === "bill_vote" && (
                  <div className="mt-3 rounded-lg border p-3 text-center">
                    {(() => {
                      const ayes =
                        tallies.find((t) => t.vote_value === "aye")?.count ?? 0;
                      const nays =
                        tallies.find((t) => t.vote_value === "nay")?.count ?? 0;
                      const passed = ayes > nays;
                      return (
                        <div
                          className={cn(
                            "flex items-center justify-center gap-2 text-lg font-bold",
                            passed ? "text-green-700" : "text-red-700"
                          )}
                        >
                          {passed ? (
                            <CheckCircle2 className="size-5" />
                          ) : (
                            <XCircle className="size-5" />
                          )}
                          {passed ? "BILL PASSED" : "BILL REJECTED"}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Speaker election result: Speaker (#1) + Deputy Speakers (#2,#3).
                    A DEPUTY-seat runoff must not be read as a Speaker election —
                    its winner takes the open deputy seat (the server reveal writes
                    the authoritative roles; this block mirrors that reading). */}
                {isRevealed &&
                  voteSession.vote_type === "speaker_election" &&
                  (() => {
                    const nameOf = (id: string) =>
                      candidates.find((c) => c.id === id)?.full_name ?? id;
                    const cfg = (voteSession.config ?? {}) as {
                      isRunoff?: boolean;
                      runoffSeat?: string;
                      openDeputySeats?: number;
                    };
                    const outcome =
                      cfg.isRunoff && cfg.runoffSeat === "deputy"
                        ? (() => {
                            const dep = computeDeputyRunoffOutcome(
                              tallies,
                              cfg.openDeputySeats ?? 1
                            );
                            return {
                              speakerId: null,
                              deputyIds: dep.deputyIds,
                              partyLeaderId: null,
                              tie: dep.tie,
                            };
                          })()
                        : computeElectionOutcome("speaker_election", tallies);
                    return (
                      <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
                        {outcome.speakerId && (
                          <div className="flex items-center gap-2 font-semibold text-amber-700">
                            <Crown className="size-4 text-amber-500" />
                            Speaker: {nameOf(outcome.speakerId)}
                          </div>
                        )}
                        {outcome.deputyIds.length > 0 && (
                          <div className="text-gray-700">
                            Deputy Speaker
                            {outcome.deputyIds.length > 1 ? "s" : ""}:{" "}
                            {outcome.deputyIds.map(nameOf).join(", ")}
                          </div>
                        )}
                        {outcome.tie && (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                            <div className="font-medium text-amber-800">
                              Tie for the{" "}
                              {outcome.tie.seat === "speaker"
                                ? "Speaker seat"
                                : "2nd Deputy Speaker seat"}{" "}
                              ({outcome.tie.tiedCount} votes each):{" "}
                              {outcome.tie.tiedCandidateIds.map(nameOf).join(", ")}
                            </div>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleRunoff}
                              className="w-full"
                            >
                              Open 60-second runoff
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Party-leader election result: elected leader + tie runoff */}
                {isRevealed &&
                  voteSession.vote_type === "party_leader" &&
                  (() => {
                    const nameOf = (id: string) =>
                      candidates.find((c) => c.id === id)?.full_name ?? id;
                    const outcome = computeElectionOutcome("party_leader", tallies);
                    const partyName =
                      parties.find((p) => p.id === activeLeaderPartyId)?.name ??
                      "Party";
                    return (
                      <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
                        {outcome.partyLeaderId && (
                          <div className="flex items-center gap-2 font-semibold text-amber-700">
                            <Crown className="size-4 text-amber-500" />
                            {partyName} Leader: {nameOf(outcome.partyLeaderId)}
                          </div>
                        )}
                        {outcome.tie && (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                            <div className="font-medium text-amber-800">
                              Tie for {partyName} Leader (
                              {outcome.tie.tiedCount} votes each):{" "}
                              {outcome.tie.tiedCandidateIds.map(nameOf).join(", ")}
                            </div>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleRunoff}
                              className="w-full"
                            >
                              Open 60-second runoff
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {isOpen && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleCloseVoting}
                  className="flex-1"
                >
                  <StopCircle className="size-3.5 mr-1" />
                  Close Voting
                </Button>
              )}
              {isClosed && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={handleRevealResults}
                  className="flex-1"
                >
                  <Eye className="size-3.5 mr-1" />
                  Reveal Results
                </Button>
              )}
            </div>

            {/* Floor capture — manual roll-call entry, only while open */}
            {isOpen && (
              <FloorCapture
                sessionId={voteSession.id}
                voteType={voteSession.vote_type}
                candidates={candidates}
              />
            )}

            {/* After a party-leader result is revealed, let the organiser run
                the next party's election (a new session is allowed once the
                previous one is revealed). */}
            {isRevealed &&
              voteSession.vote_type === "party_leader" &&
              partyLeaderList && (
                <div className="border-t pt-4">{partyLeaderList}</div>
              )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              <DialogDescription>
                {confirmDialog.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setConfirmDialog((prev) => ({ ...prev, open: false }))
                }
              >
                Cancel
              </Button>
              <Button disabled={isPending} onClick={confirmDialog.action}>
                {isPending ? "Processing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Party-Leader nomination dialog (re-elect / next party after reveal) */}
        {partyLeaderDialog}
      </>
    );
  }

  // ─── No active session — Show open voting buttons ─────────────

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Vote className="size-4" />
            Digital Voting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Speaker Election */}
          {agendaType === "speaker_election" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {candidates.length} speaker candidates found. Open voting to let
                participants elect the Speaker.
              </p>

              {/* Candidate list */}
              {candidates.length > 0 && (
                <div className="space-y-1.5 rounded-lg border bg-gray-50/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Candidates:
                  </p>
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium text-gray-800">
                        {c.full_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {c.school_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                disabled={isPending || candidates.length === 0}
                onClick={handleOpenSpeakerElection}
                className="w-full"
              >
                <Vote className="size-3.5 mr-1.5" />
                Open Speaker Election
              </Button>
            </div>
          )}

          {/* Bill Vote */}
          {agendaType === "bill_presentation" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select a bill to open for voting. Participants will vote Aye,
                Nay, or Abstain.
              </p>

              {bills.length > 0 ? (
                <div className="space-y-2">
                  {bills.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-lg border bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {bill.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {bill.party_side === "ruling"
                            ? "Ruling Party"
                            : "Opposition"}{" "}
                          Bill
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleOpenBillVote(bill)}
                      >
                        <Landmark className="size-3.5 mr-1" />
                        Vote
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-sm text-muted-foreground">
                  No bills available for voting. Bills need to be submitted
                  first.
                </p>
              )}
            </div>
          )}

          {/* Party Leader Elections — available during any agenda item */}
          {partyLeaderList}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={confirmDialog.action}>
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Party-Leader nomination dialog: pick 3–5 nominees, then open the vote */}
      {partyLeaderDialog}
    </>
  );
}

// ─── Floor Capture (manual roll-call + corrections, organiser-only) ──

interface FloorCaptureProps {
  sessionId: string;
  voteType: string;
  candidates: VoteCandidate[];
}

const BILL_CHOICES: Array<{ value: string; label: string; cls: string }> = [
  { value: "aye", label: "AYE", cls: "bg-green-600 hover:bg-green-700 text-white" },
  { value: "nay", label: "NO", cls: "bg-red-600 hover:bg-red-700 text-white" },
  {
    value: "abstain",
    label: "ABSTAIN",
    cls: "bg-gray-500 hover:bg-gray-600 text-white",
  },
];

function FloorCapture({ sessionId, voteType, candidates }: FloorCaptureProps) {
  const [panel, setPanel] = useState<FloorPanel | null>(null);
  const [rollOpen, setRollOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Pending row currently awaiting one-tap confirm: participantId + chosen value.
  const [confirming, setConfirming] = useState<{
    participantId: string;
    value: string;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Edit dialog state for corrections.
  const [editEntry, setEditEntry] = useState<FloorManualEntry | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const candidateName = useCallback(
    (value: string) =>
      candidates.find((c) => c.id === value)?.full_name ?? value,
    [candidates]
  );

  // Candidate ballots (speaker + party-leader) resolve a participant name; bills
  // resolve a fixed aye/nay/abstain label.
  const isCandidateBallot =
    voteType === "speaker_election" || voteType === "party_leader";

  const labelForValue = useCallback(
    (value: string) => {
      if (isCandidateBallot) return candidateName(value);
      if (value === "aye") return "AYE";
      if (value === "nay") return "NO";
      if (value === "abstain") return "ABSTAIN";
      return value;
    },
    [isCandidateBallot, candidateName]
  );

  const refresh = useCallback(async () => {
    const result = await getFloorPanel(sessionId);
    if (result.success) setPanel(result.data);
  }, [sessionId]);

  // Poll every 5s while the session is open; stop on close/unmount.
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getFloorPanel(sessionId);
      if (active && result.success) setPanel(result.data);
    })();

    const id = setInterval(() => {
      void (async () => {
        const result = await getFloorPanel(sessionId);
        if (!active) return;
        if (result.success) {
          setPanel(result.data);
          // Stop polling once the organiser closes the session elsewhere.
          if (result.data.status !== "open") clearInterval(id);
        }
      })();
    }, 5000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [sessionId]);

  async function handleRecord(participantId: string, value: string) {
    setSavingId(participantId);
    const result = await castFloorVote(sessionId, participantId, value);
    setSavingId(null);
    setConfirming(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.status === "success") {
      toast.success("Vote recorded");
      void refresh();
    } else if (result.data.status === "already_voted") {
      toast.info("This participant has already voted");
      void refresh();
    } else {
      toast.error("Voting is closed");
    }
  }

  function openEdit(entry: FloorManualEntry) {
    setEditEntry(entry);
    setEditValue(entry.voteValue);
    setEditReason("");
  }

  async function handleCorrect() {
    if (!editEntry) return;
    if (!editReason.trim()) {
      toast.error("A reason is required to correct a vote");
      return;
    }
    setEditSaving(true);
    const result = await correctFloorVote(
      editEntry.voteId,
      editValue,
      editReason.trim()
    );
    setEditSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Vote corrected");
    setEditEntry(null);
    void refresh();
  }

  if (!panel) return null;

  const { turnout, channels, volunteers, pending, manualEntries } = panel;
  const pct =
    turnout.eligible > 0
      ? Math.min((turnout.cast / turnout.eligible) * 100, 100)
      : 0;

  const filteredPending = pending.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.serialNo != null && String(p.serialNo).includes(q))
    );
  });

  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-gray-50/60 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        <ClipboardList className="size-3.5 text-[#FF9933]" />
        Floor Capture
      </div>

      {/* Turnout bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Turnout</span>
          <span className="font-semibold tabular-nums">
            {turnout.cast}{" "}
            <span className="font-normal text-muted-foreground">
              / {turnout.eligible}
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Channel chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
            Self {channels.self}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
            Kiosk {channels.kiosk}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
            Organizer {channels.organizer}
          </span>
        </div>
      </div>

      {/* Volunteer chips */}
      {volunteers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {volunteers.map((v) => (
            <span
              key={v.volunteerId}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
            >
              {v.name} · {v.count}
            </span>
          ))}
        </div>
      )}

      {/* Roll call (collapsible) */}
      <div className="rounded-md border bg-white">
        <button
          type="button"
          onClick={() => setRollOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            {rollOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Roll call — {pending.length} pending
          </span>
        </button>

        {rollOpen && (
          <div className="space-y-2 border-t px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by serial or name"
                className="h-8 pl-8 text-sm"
              />
            </div>

            {filteredPending.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {pending.length === 0
                  ? "Everyone has voted."
                  : "No matches."}
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {filteredPending.map((p) => (
                  <RollCallRow
                    key={p.participantId}
                    participant={p}
                    voteType={voteType}
                    candidates={candidates}
                    confirming={
                      confirming?.participantId === p.participantId
                        ? confirming.value
                        : null
                    }
                    saving={savingId === p.participantId}
                    labelForValue={labelForValue}
                    onPick={(value) =>
                      setConfirming({ participantId: p.participantId, value })
                    }
                    onCancel={() => setConfirming(null)}
                    onConfirm={(value) => handleRecord(p.participantId, value)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual entries (collapsible) */}
      <div className="rounded-md border bg-white">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            {manualOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Manual entries ({manualEntries.length})
          </span>
        </button>

        {manualOpen && (
          <div className="border-t px-3 py-2">
            {manualEntries.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No manual or kiosk entries yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {manualEntries.map((e) => (
                  <div
                    key={e.voteId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-gray-50/60 px-2.5 py-1.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {e.serialNo != null && (
                          <span className="text-gray-400">#{e.serialNo} </span>
                        )}
                        {e.fullName}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {labelForValue(e.voteValue)} ·{" "}
                        {e.entryMethod === "volunteer_kiosk"
                          ? `Kiosk: ${e.recordedBy ?? "Volunteer"}`
                          : "Organizer"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 shrink-0 p-0"
                      onClick={() => openEdit(e)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Correction dialog */}
      <Dialog
        open={!!editEntry}
        onOpenChange={(open) => {
          if (!open) setEditEntry(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Vote</DialogTitle>
            <DialogDescription>
              {editEntry
                ? `Update the recorded vote for ${
                    editEntry.serialNo != null ? `#${editEntry.serialNo} ` : ""
                  }${editEntry.fullName}. This is logged in the audit trail.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="floor-correct-value">New value</Label>
              {isCandidateBallot ? (
                <Select
                  value={editValue}
                  onValueChange={(v) => setEditValue(v ?? "")}
                >
                  <SelectTrigger id="floor-correct-value">
                    <SelectValue placeholder="Select candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={editValue}
                  onValueChange={(v) => setEditValue(v ?? "")}
                >
                  <SelectTrigger id="floor-correct-value">
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_CHOICES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="floor-correct-reason">Reason (required)</Label>
              <Textarea
                id="floor-correct-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why is this correction being made?"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>
              Cancel
            </Button>
            <Button
              disabled={editSaving || !editReason.trim()}
              onClick={handleCorrect}
            >
              {editSaving ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Correction"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── A single pending roll-call row (pick → inline confirm → record) ──

interface RollCallRowProps {
  participant: FloorPendingParticipant;
  voteType: string;
  candidates: VoteCandidate[];
  confirming: string | null;
  saving: boolean;
  labelForValue: (value: string) => string;
  onPick: (value: string) => void;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

function RollCallRow({
  participant,
  voteType,
  candidates,
  confirming,
  saving,
  labelForValue,
  onPick,
  onCancel,
  onConfirm,
}: RollCallRowProps) {
  const p = participant;

  return (
    <div className="rounded-md border bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">
            {p.serialNo != null && (
              <span className="text-gray-400">#{p.serialNo} </span>
            )}
            {p.fullName}
          </p>
          {p.constituencyName && (
            <p className="truncate text-[11px] text-gray-500">
              {p.constituencyName}
            </p>
          )}
        </div>

        {/* Quick vote controls (only when not mid-confirm) */}
        {!confirming &&
          (voteType === "speaker_election" || voteType === "party_leader" ? (
            <Select
              onValueChange={(v: string | null) => {
                if (v) onPick(v);
              }}
              disabled={saving}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="Candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex shrink-0 gap-1">
              {BILL_CHOICES.map((b) => (
                <Button
                  key={b.value}
                  size="sm"
                  disabled={saving}
                  className={cn("h-7 px-2 text-[11px]", b.cls)}
                  onClick={() => onPick(b.value)}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          ))}
      </div>

      {/* Inline one-tap confirm */}
      {confirming && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 ring-1 ring-amber-200">
          <span className="text-xs text-amber-800">
            Record {labelForValue(confirming)} for{" "}
            {p.serialNo != null ? `#${p.serialNo} ` : ""}
            {p.fullName}?
          </span>
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={saving}
              onClick={() => onConfirm(confirming)}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
