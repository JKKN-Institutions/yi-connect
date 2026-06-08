"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Vote, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { useVoteSession } from "@/lib/yip/hooks/use-vote-session";
import { hasParticipantVoted } from "@/app/yip/actions/voting";

interface VoteNowCardProps {
  eventId: string;
  participantId: string;
}

export function VoteNowCard({ eventId, participantId }: VoteNowCardProps) {
  const { session: voteSession, isOpen, loading } = useVoteSession(eventId);
  const [hasVoted, setHasVoted] = useState(false);
  const [checkingVote, setCheckingVote] = useState(true);

  // Check if participant already voted
  useEffect(() => {
    if (!voteSession) {
      setCheckingVote(false);
      return;
    }

    async function checkVote() {
      if (!voteSession) return;
      // Votes are RLS-sealed until reveal, so check via the participant-gated
      // server action rather than reading the votes table from the browser.
      const res = await hasParticipantVoted(voteSession.id, participantId);
      setHasVoted(res.success && res.data.hasVoted);
      setCheckingVote(false);
    }

    checkVote();
  }, [voteSession?.id, participantId]);

  if (loading || checkingVote) return null;
  if (!voteSession || !isOpen) return null;

  // Already voted
  if (hasVoted) {
    return (
      <Card className="border-green-200 bg-green-50/50 overflow-hidden">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-600" />
              <div>
                <p className="text-sm font-bold text-green-800">
                  Vote Recorded
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  Your vote has been cast. Results will be announced.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Vote now
  return (
    <Link href="/yip/me/vote">
      <Card className="border-[#FF9933] bg-gradient-to-r from-[#FF9933]/10 to-amber-50 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
        <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] to-amber-400 animate-pulse" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#FF9933] animate-pulse">
                <Vote className="size-5 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">
                  VOTE NOW
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {voteSession.vote_type === "speaker_election"
                    ? "Speaker Election is open"
                    : "Bill voting is open"}
                </p>
              </div>
            </div>
            <ChevronRight className="size-5 text-[#FF9933]" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
