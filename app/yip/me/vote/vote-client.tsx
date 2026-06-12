"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import {
  Vote,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Landmark,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/yip/utils";
import { PARTY_COLORS, ROLE_LABELS } from "@/lib/yip/constants";
import { useVoteSession } from "@/lib/yip/hooks/use-vote-session";
import {
  castVote,
  getSpeakerCandidates,
  getVoteCandidates,
  hasParticipantVoted,
  type VoteCandidate,
} from "@/app/yip/actions/voting";
import { createClient } from "@/lib/yip/supabase/client";

// ─── Session (server-provided) ──────────────────────────────────
// The yip_session cookie is httpOnly, so it CANNOT be read from
// document.cookie — the server page parses it and passes it down.

export interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

// ─── Page Component ─────────────────────────────────────────────

export function VoteClient({
  initialSession,
}: {
  initialSession: ParticipantSession;
}) {
  const session: ParticipantSession | null = initialSession;
  const [candidates, setCandidates] = useState<VoteCandidate[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [billTitle, setBillTitle] = useState<string | null>(null);
  const [billObjective, setBillObjective] = useState<string | null>(null);

  const eventId = session?.eventId ?? "";
  const { session: voteSession, isOpen, isClosed, isRevealed, loading } =
    useVoteSession(eventId);

  // Load candidates / bill info when vote session becomes available
  useEffect(() => {
    if (!voteSession || !session) {
      setLoadingCandidates(false);
      return;
    }

    async function loadData() {
      if (!voteSession || !session) return;

      if (voteSession.vote_type === "speaker_election") {
        const data = await getSpeakerCandidates(session.eventId);
        setCandidates(data);
      }

      if (voteSession.vote_type === "party_leader") {
        // Candidates are the nominees the organiser picked (config.candidateIds).
        const cfg = (voteSession.config ?? {}) as { candidateIds?: unknown };
        const ids = Array.isArray(cfg.candidateIds)
          ? cfg.candidateIds.filter((x): x is string => typeof x === "string")
          : [];
        const data = await getVoteCandidates(ids);
        setCandidates(data);
      }

      if (voteSession.vote_type === "bill_vote" && voteSession.bill_id) {
        const supabase = createClient();
        const { data: bill } = await supabase
          .from("bills")
          .select("title, objective")
          .eq("id", voteSession.bill_id)
          .single();
        if (bill) {
          setBillTitle(bill.title);
          setBillObjective(bill.objective);
        }
      }

      // Check if already voted — via server action (votes are RLS-sealed until
      // reveal, so the browser client can't read them during an open session).
      const votedRes = await hasParticipantVoted(voteSession.id, session.id);
      if (votedRes.success && votedRes.data.hasVoted) {
        setHasVoted(true);
      }

      setLoadingCandidates(false);
    }

    loadData();
  }, [voteSession?.id, session?.id]);

  function handleCastVote() {
    if (!voteSession || !session || !selectedValue) return;

    startTransition(async () => {
      const result = await castVote(voteSession.id, session.id, selectedValue);

      if (result.success) {
        if (result.data.status === "success") {
          setHasVoted(true);
          toast.success("Your vote has been recorded!");
        } else if (result.data.status === "already_voted") {
          setHasVoted(true);
          toast.info("You have already voted in this session");
        } else if (result.data.status === "closed") {
          toast.error("Voting has been closed");
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  // ─── No session ───────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="size-10 text-amber-400 mb-3" />
        <p className="text-gray-600">Session not found. Please rejoin the event.</p>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────

  if (loading || loadingCandidates) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#FF9933]" />
        <p className="mt-3 text-sm text-gray-500">Loading vote session...</p>
      </div>
    );
  }

  // ─── No active vote ───────────────────────────────────────────

  if (!voteSession || isRevealed) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Vote className="size-5 text-[#FF9933]" />
            Digital Voting
          </h1>
        </div>
        <Card className="border-gray-200">
          <CardContent className="pt-5 text-center py-10">
            <Clock className="mx-auto size-12 text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No Vote in Progress</p>
            <p className="text-sm text-gray-500 mt-1">
              You will be notified when voting opens. Check back during the
              relevant agenda item.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Already voted ────────────────────────────────────────────

  if (hasVoted) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Vote className="size-5 text-[#FF9933]" />
            Digital Voting
          </h1>
        </div>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-5 text-center py-10">
            <CheckCircle2 className="mx-auto size-14 text-green-500 mb-3" />
            <p className="text-lg font-bold text-green-800">
              Your vote has been recorded
            </p>
            <p className="text-sm text-green-600 mt-1">
              Thank you for participating in the democratic process.
              {isClosed && " Results will be revealed shortly."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Voting closed (didn't vote in time) ──────────────────────

  if (isClosed && !hasVoted) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Vote className="size-5 text-[#FF9933]" />
            Digital Voting
          </h1>
        </div>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5 text-center py-10">
            <Clock className="mx-auto size-12 text-amber-400 mb-3" />
            <p className="font-medium text-gray-700">Voting Has Closed</p>
            <p className="text-sm text-gray-500 mt-1">
              The voting window has ended. Results will be revealed shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Candidate ballot (Speaker election + Party-Leader election) ──
  // Both render an identical candidate grid; vote_value is the candidate id.

  if (
    voteSession.vote_type === "speaker_election" ||
    voteSession.vote_type === "party_leader"
  ) {
    const isPartyLeader = voteSession.vote_type === "party_leader";
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Vote className="size-5 text-[#FF9933]" />
            {isPartyLeader ? "Vote for Party Leader" : "Vote for Speaker"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isPartyLeader
              ? "Select one candidate to be your party's leader"
              : "Select one candidate to be the Speaker of the House"}
          </p>
        </div>

        {/* Instruction */}
        <Card className="border-[#FF9933]/20 bg-[#FF9933]/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-700">
              {isPartyLeader
                ? "Only members of your party can vote in this election. "
                : ""}
              Tap on a candidate to select them, then press &quot;Cast Vote&quot;
              to confirm. Your vote is secret and cannot be changed once cast.
            </p>
          </CardContent>
        </Card>

        {/* Candidate Grid */}
        <div className="space-y-3">
          {candidates.map((candidate) => {
            const isSelected = selectedValue === candidate.id;
            const partySide = candidate.party_side as
              | "ruling"
              | "opposition"
              | null;

            return (
              <button
                key={candidate.id}
                onClick={() => setSelectedValue(candidate.id)}
                className={cn(
                  "w-full rounded-xl border-2 p-4 text-left transition-all",
                  isSelected
                    ? "border-[#FF9933] bg-[#FF9933]/5 ring-2 ring-[#FF9933]/30 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-900">
                      {candidate.full_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <GraduationCap className="size-3.5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {candidate.school_name}
                      </span>
                    </div>
                    {partySide && (
                      <div className="mt-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            PARTY_COLORS[partySide].badge
                          )}
                        >
                          {partySide === "ruling"
                            ? "Ruling Party"
                            : "Opposition"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected
                        ? "border-[#FF9933] bg-[#FF9933]"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {isSelected && (
                      <CheckCircle2 className="size-4 text-white" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cast Vote Button */}
        <Button
          onClick={handleCastVote}
          disabled={isPending || !selectedValue}
          className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-base py-6"
          size="lg"
        >
          {isPending ? (
            "Casting Vote..."
          ) : (
            <>
              <Vote className="size-5 mr-2" />
              Cast Vote
            </>
          )}
        </Button>
      </div>
    );
  }

  // ─── Bill Vote ────────────────────────────────────────────────

  if (voteSession.vote_type === "bill_vote") {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="size-5 text-[#FF9933]" />
            Vote on Bill
          </h1>
        </div>

        {/* Bill Info */}
        {billTitle && (
          <Card className="border-purple-200/50 overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-purple-400 to-violet-400" />
            <CardContent className="pt-4 pb-4">
              <h2 className="text-base font-bold text-gray-900">{billTitle}</h2>
              {billObjective && (
                <p className="text-sm text-gray-600 mt-2">{billObjective}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instruction */}
        <Card className="border-[#FF9933]/20 bg-[#FF9933]/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-700">
              Cast your vote on the bill. You may vote Aye (in favor), Nay
              (against), or Abstain. Your vote cannot be changed once cast.
            </p>
          </CardContent>
        </Card>

        {/* Vote Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => setSelectedValue("aye")}
            className={cn(
              "w-full rounded-xl border-2 p-5 text-center transition-all",
              selectedValue === "aye"
                ? "border-green-500 bg-green-50 ring-2 ring-green-300 shadow-md"
                : "border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/50"
            )}
          >
            <p className="text-2xl font-black text-green-600">AYE</p>
            <p className="text-sm text-green-600/70 mt-1">In favor of the bill</p>
          </button>

          <button
            onClick={() => setSelectedValue("nay")}
            className={cn(
              "w-full rounded-xl border-2 p-5 text-center transition-all",
              selectedValue === "nay"
                ? "border-red-500 bg-red-50 ring-2 ring-red-300 shadow-md"
                : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/50"
            )}
          >
            <p className="text-2xl font-black text-red-600">NAY</p>
            <p className="text-sm text-red-600/70 mt-1">Against the bill</p>
          </button>

          <button
            onClick={() => setSelectedValue("abstain")}
            className={cn(
              "w-full rounded-xl border-2 p-5 text-center transition-all",
              selectedValue === "abstain"
                ? "border-gray-500 bg-gray-50 ring-2 ring-gray-300 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
            )}
          >
            <p className="text-2xl font-black text-gray-500">ABSTAIN</p>
            <p className="text-sm text-gray-400 mt-1">Neither for nor against</p>
          </button>
        </div>

        {/* Cast Vote Button */}
        <Button
          onClick={handleCastVote}
          disabled={isPending || !selectedValue}
          className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-base py-6"
          size="lg"
        >
          {isPending ? (
            "Casting Vote..."
          ) : (
            <>
              <Vote className="size-5 mr-2" />
              Cast Vote
            </>
          )}
        </Button>
      </div>
    );
  }

  return null;
}
