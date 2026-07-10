"use client";

/**
 * Party Leaders Card (Positions tab).
 *
 * party_leader is PARTY-scoped — one leader per party — and carries a second
 * field (parties.party_leader_id), so like committee_chair it gets its own
 * per-party card instead of a flat tile in the generic Key Positions card. One
 * tile per party shows the party's current leader and an assign picker scoped to
 * THAT party's members.
 *
 * Writes route through electPartyLeader / clearPartyLeader (parties.ts) — NOT
 * the generic setParliamentRole — so the party_leader_id link and the
 * parliament_role stay in sync and the outgoing leader is demoted (no
 * double-counted +bonus).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Crown, X, Plus } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { electPartyLeader, clearPartyLeader } from "@/app/yip/actions/parties";
import type {
  PartyLeadersData,
  PartyLeaderMember,
} from "@/app/yip/actions/positions";

interface Props {
  data: PartyLeadersData;
}

function partyDot(side: string | null) {
  if (side === "ruling") return "bg-blue-500";
  if (side === "opposition") return "bg-red-500";
  return "bg-[#FF9933]";
}

// Canonical participant identity: "#<constituency no> · <constituency name>".
function constLabel(m: PartyLeaderMember): string {
  const parts: string[] = [];
  if (m.constituency_number != null) parts.push(`#${m.constituency_number}`);
  if (m.constituency_name) parts.push(m.constituency_name);
  return parts.join(" · ");
}

export function PartyLeadersCard({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [pickValue, setPickValue] = useState<string>("");

  function handleAssign(partyId: string, partyName: string, participantId: string) {
    if (!participantId) return;
    startTransition(async () => {
      const result = await electPartyLeader(partyId, participantId);
      if (result.success) {
        toast.success(`Leader set for ${partyName}`);
        setOpenParty(null);
        setPickValue("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove(partyId: string, leader: PartyLeaderMember, partyName: string) {
    startTransition(async () => {
      const result = await clearPartyLeader(partyId);
      if (result.success) {
        toast.success(`${leader.full_name} removed as leader of ${partyName}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="border-l-4 border-l-[#FF9933]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="size-4 text-[#FF9933]" />
          Party Leaders
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            One leader per party.
            {data.bonus > 0 ? ` Jury adds +${data.bonus} to the leader's scores.` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data.parties.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">
            No parties yet. Create parties on the Parties tab, then set each
            party&apos;s leader here.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.parties.map((row) => {
              const isOpen = openParty === row.partyId;
              // Never offer the current leader as a re-pick.
              const candidates = row.eligibleMembers.filter(
                (m) => m.id !== row.leader?.id
              );
              return (
                <div
                  key={row.partyId}
                  className="rounded-lg border bg-card p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate font-medium text-sm">
                      <span className="text-muted-foreground">
                        #{row.partyNumber}
                      </span>{" "}
                      {row.partyName}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 text-xs",
                        data.bonus > 0
                          ? "bg-[#138808]/10 text-[#138808]"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {data.bonus > 0 ? `+${data.bonus}` : data.bonus} bonus
                    </Badge>
                  </div>

                  {!row.leader ? (
                    <div className="mb-2 text-xs italic text-muted-foreground">
                      No leader yet
                    </div>
                  ) : (
                    <ul className="mb-2 space-y-1">
                      <li className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "inline-block size-1.5 shrink-0 rounded-full",
                              partyDot(row.leader.party_side)
                            )}
                          />
                          <span className="truncate">{row.leader.full_name}</span>
                          {constLabel(row.leader) && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {constLabel(row.leader)}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${row.leader.full_name} as leader of ${row.partyName}`}
                          onClick={() =>
                            handleRemove(row.partyId, row.leader!, row.partyName)
                          }
                          disabled={isPending}
                          className="shrink-0 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    </ul>
                  )}

                  {isOpen ? (
                    <div className="flex flex-col gap-2">
                      <select
                        autoFocus
                        value={pickValue}
                        onChange={(e) => setPickValue(e.target.value)}
                        disabled={isPending}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF9933]/40"
                      >
                        <option value="">Select a party member…</option>
                        {candidates.map((p) => (
                          <option key={p.id} value={p.id}>
                            {constLabel(p)
                              ? `${constLabel(p)} — ${p.full_name}`
                              : p.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          type="button"
                          disabled={isPending || !pickValue}
                          onClick={() =>
                            handleAssign(row.partyId, row.partyName, pickValue)
                          }
                          className="h-7 flex-1 bg-[#138808] text-xs hover:bg-[#138808]/90"
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => {
                            setOpenParty(null);
                            setPickValue("");
                          }}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                      {candidates.length === 0 && (
                        <p className="text-[10px] italic text-muted-foreground">
                          No eligible members — everyone else already holds a
                          senior post.
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenParty(row.partyId);
                        setPickValue("");
                      }}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs text-[#FF9933] hover:underline disabled:opacity-50"
                    >
                      <Plus className="size-3" />
                      {row.leader ? "Change leader" : "Assign leader"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
