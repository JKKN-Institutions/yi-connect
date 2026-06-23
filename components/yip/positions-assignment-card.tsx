"use client";

/**
 * Positions Assignment Card (Phase 18 / F3).
 *
 * Shown on the event Control Panel. For each of the 6 key parliament
 * roles, displays the role's jury bonus and the currently-assigned
 * participants, with an inline dropdown to assign / unassign people.
 *
 * Writes go through `setParliamentRole` from `participants.ts`. No
 * scoring logic lives here — this card is purely metadata.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Crown, X, Plus } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { setParliamentRole } from "@/app/yip/actions/participants";
import type {
  PositionRoleGroup,
  PositionParticipant,
} from "@/app/yip/actions/positions";
import type { Database } from "@/types/yip/database";

type ParliamentRole = Database["public"]["Enums"]["parliament_role"];

interface EventParticipant {
  id: string;
  full_name: string;
  party_side: string | null;
  parliament_role: ParliamentRole | null;
}

interface Props {
  groups: PositionRoleGroup[];
  allParticipants: EventParticipant[];
}

function partyDot(side: string | null) {
  if (side === "ruling") return "bg-blue-500";
  if (side === "opposition") return "bg-red-500";
  // Benchless (side decided live on event day) — neutral saffron, not a
  // "no party" gray; the participant still belongs to a party.
  return "bg-[#FF9933]";
}

export function PositionsAssignmentCard({ groups, allParticipants }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openRole, setOpenRole] = useState<ParliamentRole | null>(null);
  const [pickValue, setPickValue] = useState<string>("");

  function handleAssign(role: ParliamentRole, participantId: string) {
    if (!participantId) return;
    startTransition(async () => {
      const result = await setParliamentRole(participantId, role);
      if (result.success) {
        toast.success("Role assigned");
        setOpenRole(null);
        setPickValue("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleUnassign(p: PositionParticipant) {
    startTransition(async () => {
      const result = await setParliamentRole(p.id, null);
      if (result.success) {
        toast.success(`${p.full_name} removed from role`);
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
          Key Positions
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Jury adds the role bonus to every score for these participants.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const isOpen = openRole === group.role;
            // Exclude participants already assigned to this role.
            const candidates = allParticipants.filter(
              (p) => p.parliament_role !== group.role
            );
            return (
              <div
                key={group.role}
                className="rounded-lg border bg-card p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{group.label}</div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      group.bonus > 0
                        ? "bg-[#138808]/10 text-[#138808]"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {group.bonus > 0 ? `+${group.bonus}` : group.bonus} bonus
                  </Badge>
                </div>

                {group.participants.length === 0 ? (
                  <div className="mb-2 text-xs italic text-muted-foreground">
                    No one assigned
                  </div>
                ) : (
                  <ul className="mb-2 space-y-1">
                    {group.participants.map((p) => (
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
                          aria-label={`Remove ${p.full_name} from ${group.label}`}
                          onClick={() => handleUnassign(p)}
                          disabled={isPending}
                          className="text-muted-foreground hover:text-red-600 disabled:opacity-50"
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
                      <option value="">Select a participant…</option>
                      {candidates.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                          {p.parliament_role
                            ? ` (currently ${p.parliament_role.replace(/_/g, " ")})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        type="button"
                        disabled={isPending || !pickValue}
                        onClick={() => handleAssign(group.role, pickValue)}
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
                          setOpenRole(null);
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
                      setOpenRole(group.role);
                      setPickValue("");
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 text-xs text-[#FF9933] hover:underline disabled:opacity-50"
                  >
                    <Plus className="size-3" />
                    Assign participant
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
