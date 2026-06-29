"use client";

/**
 * Election Results Roll-up (control panel).
 *
 * A PERSISTENT summary of every revealed vote — Speaker, party leaders, PM /
 * Deputy / LoP, cabinet / shadow ministers, bills, motions — so results stay
 * visible even after a newer vote opens. (The live VoteManager card only ever
 * shows the single latest session, so e.g. the Speaker result disappears the
 * moment a party-leader vote starts; this panel keeps it.)
 *
 * Each election is a collapsible row: collapsed shows the winner; expand for the
 * full vote breakdown. Re-fetches on any vote_sessions change so a fresh reveal
 * appears immediately without a manual refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import { getElectionResults } from "@/app/yip/actions/voting";
import type { RollupEntry } from "@/lib/yip/election-rollup";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import {
  Trophy,
  Crown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";

interface Props {
  eventId: string;
}

export function ElectionResultsRollup({ eventId }: Props) {
  const supabase = createClient();
  const [results, setResults] = useState<RollupEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refetch = useCallback(async () => {
    const data = await getElectionResults(eventId);
    setResults(data);
    setLoaded(true);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Re-fetch whenever a vote session changes (a reveal flips status → revealed).
  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`yip:results-rollup:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "vote_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Nothing to show until at least one result is revealed.
  if (!loaded || results.length === 0) return null;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="border-l-4 border-l-[#138808]">
      <CardHeader className="pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SAFFRON }}>RESULTS</p>
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground" style={{ ...SERIF, color: INK }}>
          <Trophy className="size-4 text-[#138808]" />
          Results so far
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Every revealed vote — stays here as the agenda moves on.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {results.map((entry) => {
          const isOpen = expanded.has(entry.sessionId);
          const winner = entry.options.find((o) => o.isWinner);
          const maxCount = Math.max(...entry.options.map((o) => o.count), 1);
          return (
            <div
              key={entry.sessionId}
              className="rounded-lg border bg-card shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggle(entry.sessionId)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {entry.title}
                    </span>
                    {/* Collapsed summary: winner (candidate votes) or outcome. */}
                    {!isOpen && (
                      <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        {winner ? (
                          <>
                            <Crown className="size-3 shrink-0 text-amber-500" />
                            <span className="truncate">
                              {winner.label} · {winner.count} votes
                            </span>
                          </>
                        ) : entry.subtitle ? (
                          <span className="truncate">{entry.subtitle}</span>
                        ) : (
                          <span className="truncate">
                            {entry.totalVotes} votes
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </span>
                {entry.voteType === "bill_vote" && entry.subtitle && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 text-[10px]",
                      entry.subtitle === "Passed"
                        ? "bg-[#138808]/10 text-[#138808]"
                        : "bg-red-100 text-red-700"
                    )}
                  >
                    {entry.subtitle}
                  </Badge>
                )}
              </button>

              {isOpen && (
                <div className="space-y-1.5 border-t px-3 py-2.5">
                  {entry.subtitle && entry.voteType !== "bill_vote" && (
                    <p className="text-[11px] text-muted-foreground">
                      {entry.subtitle}
                    </p>
                  )}
                  {entry.options.map((opt, i) => {
                    const pct =
                      entry.totalVotes > 0
                        ? Math.round((opt.count / entry.totalVotes) * 100)
                        : 0;
                    const barColor =
                      opt.kind === "aye"
                        ? "bg-green-500"
                        : opt.kind === "nay"
                        ? "bg-red-500"
                        : opt.kind === "abstain"
                        ? "bg-gray-400"
                        : opt.isWinner
                        ? "bg-[#138808]"
                        : "bg-[#FF9933]";
                    return (
                      <div key={`${opt.label}-${i}`} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className={cn(
                              "flex min-w-0 items-center gap-1.5 font-medium",
                              opt.isWinner ? "text-amber-700" : "text-gray-700"
                            )}
                          >
                            {opt.isWinner && (
                              <Crown className="size-3 shrink-0 text-amber-500" />
                            )}
                            <span className="truncate">{opt.label}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-600">
                            {opt.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn("h-full rounded-full", barColor)}
                            style={{
                              width: `${Math.round((opt.count / maxCount) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="pt-0.5 text-[11px] text-muted-foreground">
                    {entry.totalVotes} total votes
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
