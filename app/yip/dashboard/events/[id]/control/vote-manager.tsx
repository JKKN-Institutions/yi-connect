"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { useVoteSession } from "@/hooks/yip/use-vote-session";
import {
  openVote,
  closeVote,
  revealResults,
  getSpeakerCandidates,
  getEventBills,
  type VoteCandidate,
} from "@/app/actions/voting";
import type { Tables } from "@/types/yip/database";

// ─── Types ──────────────────────────────────────────────────────

type AgendaItem = Tables<"agenda_items">;

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
  const showVoteControls =
    agendaType === "speaker_election" || agendaType === "bill_presentation";

  // Fetch candidates or bills when agenda type warrants it
  useEffect(() => {
    if (agendaType === "speaker_election") {
      getSpeakerCandidates(eventId).then(setCandidates);
    }
    if (agendaType === "bill_presentation") {
      getEventBills(eventId).then(setBills);
    }
  }, [agendaType, eventId]);

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
                  const isWinner =
                    isRevealed && tally.count === tallies[0].count;

                  // Determine label and color
                  let label = tally.vote_value;
                  let barColor = "bg-gray-400";

                  if (voteSession.vote_type === "speaker_election") {
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
    </>
  );
}
