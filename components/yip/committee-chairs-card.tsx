"use client";

/**
 * Committee Chairs Card (Positions tab).
 *
 * committee_chair is committee-SCOPED — one chair per committee — so it gets its
 * own committee-wise card instead of a flat tile in the generic Key Positions
 * card. One tile per committee shows the committee's current chair and an assign
 * picker scoped to THAT committee's members.
 *
 * Writes reuse `setParliamentRole` from `participants.ts` (sets only
 * parliament_role; committee_name is untouched, so a committee member made
 * committee_chair becomes that committee's chair — unlocking bill editing).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Gavel, X, Plus } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { setParliamentRole } from "@/app/yip/actions/participants";
import type {
  CommitteeChairsData,
  PositionParticipant,
} from "@/app/yip/actions/positions";

interface Props {
  data: CommitteeChairsData;
}

function partyDot(side: string | null) {
  if (side === "ruling") return "bg-blue-500";
  if (side === "opposition") return "bg-red-500";
  return "bg-[#FF9933]";
}

export function CommitteeChairsCard({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openCommittee, setOpenCommittee] = useState<string | null>(null);
  const [pickValue, setPickValue] = useState<string>("");

  function handleAssign(committee: string, participantId: string) {
    if (!participantId) return;
    startTransition(async () => {
      const result = await setParliamentRole(participantId, "committee_chair");
      if (result.success) {
        toast.success(`Chair set for ${committee}`);
        setOpenCommittee(null);
        setPickValue("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove(p: PositionParticipant, committee: string) {
    startTransition(async () => {
      const result = await setParliamentRole(p.id, null);
      if (result.success) {
        toast.success(`${p.full_name} removed as chair of ${committee}`);
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
          <Gavel className="size-4 text-[#FF9933]" />
          Committee Chairs
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Each committee&apos;s chair unlocks bill editing for that committee.
            {data.bonus > 0 ? ` Jury adds +${data.bonus} to the chair's scores.` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data.committees.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">
            No committees yet. Allocate participants to committees on the
            Allocation tab, then assign each committee&apos;s chair here.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.committees.map((row) => {
              const isOpen = openCommittee === row.committee;
              const chairIds = new Set(row.chairs.map((c) => c.id));
              const candidates = row.members.filter((m) => !chairIds.has(m.id));
              return (
                <div
                  key={row.committee}
                  className="rounded-lg border bg-card p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate font-medium text-sm">
                      {row.committee}
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

                  {row.chairs.length === 0 ? (
                    <div className="mb-2 text-xs italic text-muted-foreground">
                      No chair yet
                    </div>
                  ) : (
                    <ul className="mb-2 space-y-1">
                      {row.chairs.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "inline-block size-1.5 shrink-0 rounded-full",
                                partyDot(p.party_side)
                              )}
                            />
                            <span className="truncate">{p.full_name}</span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${p.full_name} as chair of ${row.committee}`}
                            onClick={() => handleRemove(p, row.committee)}
                            disabled={isPending}
                            className="shrink-0 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
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
                        <option value="">Select a committee member…</option>
                        {candidates.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          type="button"
                          disabled={isPending || !pickValue}
                          onClick={() => handleAssign(row.committee, pickValue)}
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
                            setOpenCommittee(null);
                            setPickValue("");
                          }}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCommittee(row.committee);
                        setPickValue("");
                      }}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs text-[#FF9933] hover:underline disabled:opacity-50"
                    >
                      <Plus className="size-3" />
                      {row.chairs.length === 0 ? "Assign chair" : "Add / change chair"}
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
