"use client";

/**
 * Cabinet / Shadow Ministers Card (Positions tab).
 *
 * Two modes (driven by getCommitteeMinisters → data.portfolioMode):
 *   • PORTFOLIO mode — rows are the chapter's chosen ministries (Cabinet tab).
 *     A minister is ANY ruling/opposition MP (not committee-bound); the post is
 *     stored via setCabinetPortfolio (parliament_role + cabinet_portfolio).
 *   • COMMITTEE mode (legacy, no cabinet configured) — rows are committees,
 *     pools restricted to committee members; writes reuse setParliamentRole.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Landmark, X, Plus } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { setParliamentRole } from "@/app/yip/actions/participants";
import {
  setCabinetPortfolio,
  clearCabinetPortfolio,
} from "@/app/yip/actions/positions";
import type {
  CommitteeMinistersData,
  CommitteeMinisterRow,
  PositionParticipant,
} from "@/app/yip/actions/positions";

interface Props {
  data: CommitteeMinistersData;
  eventId: string;
}

type Seat = "cabinet" | "shadow";

function partyDot(side: string | null) {
  if (side === "ruling") return "bg-blue-500";
  if (side === "opposition") return "bg-red-500";
  return "bg-[#FF9933]";
}

export function CommitteeMinistersCard({ data, eventId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const portfolio = data.portfolioMode;
  // Open picker is keyed by `${committee}::${seat}` so only one is open at a time.
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [pickValue, setPickValue] = useState<string>("");

  const seatLabel = (seat: Seat) =>
    seat === "cabinet" ? "Cabinet Minister" : "Shadow Minister";
  const seatRole = (seat: Seat) =>
    seat === "cabinet" ? "cabinet_minister" : "shadow_minister";
  const seatBonus = (seat: Seat) =>
    seat === "cabinet" ? data.cabinetBonus : data.shadowBonus;

  function handleAssign(committee: string, seat: Seat, participantId: string) {
    if (!participantId) return;
    startTransition(async () => {
      const result = portfolio
        ? await setCabinetPortfolio({
            eventId,
            participantId,
            ministry: committee,
            seat,
          })
        : await setParliamentRole(participantId, seatRole(seat));
      if (result.success) {
        toast.success(`${seatLabel(seat)} set for ${committee}`);
        setOpenSlot(null);
        setPickValue("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove(p: PositionParticipant, committee: string, seat: Seat) {
    startTransition(async () => {
      const result = portfolio
        ? await clearCabinetPortfolio({ eventId, participantId: p.id })
        : await setParliamentRole(p.id, null);
      if (result.success) {
        toast.success(
          `${p.full_name} removed as ${seatLabel(seat)} of ${committee}`
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function renderSeat(row: CommitteeMinisterRow, seat: Seat) {
    const holders = seat === "cabinet" ? row.cabinet : row.shadow;
    const pool = seat === "cabinet" ? row.rulingMembers : row.oppositionMembers;
    const slotKey = `${row.committee}::${seat}`;
    const isOpen = openSlot === slotKey;
    const holderIds = new Set(holders.map((h) => h.id));
    const candidates = pool.filter((m) => !holderIds.has(m.id));
    const bonus = seatBonus(seat);

    return (
      <div className="rounded-md border bg-muted/20 p-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                seat === "cabinet" ? "bg-blue-500" : "bg-red-500"
              )}
            />
            {seatLabel(seat)}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 text-[10px]",
              bonus > 0
                ? "bg-[#138808]/10 text-[#138808]"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {bonus > 0 ? `+${bonus}` : bonus}
          </Badge>
        </div>

        {holders.length === 0 ? (
          <div className="mb-1.5 text-[11px] italic text-muted-foreground">
            Not assigned
          </div>
        ) : (
          <ul className="mb-1.5 space-y-1">
            {holders.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded bg-card px-2 py-1 text-xs"
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
                  aria-label={`Remove ${p.full_name} as ${seatLabel(seat)} of ${row.committee}`}
                  onClick={() => handleRemove(p, row.committee, seat)}
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
              <option value="">
                {candidates.length === 0
                  ? `No ${seat === "cabinet" ? "ruling" : "opposition"} ${
                      portfolio ? "MPs available" : "members in this committee"
                    }`
                  : "Select a member…"}
              </option>
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
                onClick={() => handleAssign(row.committee, seat, pickValue)}
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
                  setOpenSlot(null);
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
              setOpenSlot(slotKey);
              setPickValue("");
            }}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-[#FF9933] hover:underline disabled:opacity-50"
          >
            <Plus className="size-3" />
            {holders.length === 0 ? "Assign" : "Add / change"}
          </button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-l-4 border-l-[#FF9933]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Landmark className="size-4 text-[#FF9933]" />
          Cabinet &amp; Shadow Ministers
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            One Cabinet Minister (ruling) and one Shadow Minister (opposition) per{" "}
            {portfolio ? "ministry" : "committee"}. Jury adds the role bonus to
            their scores.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data.committees.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">
            {portfolio
              ? "No cabinet ministries chosen yet. Pick them on the Cabinet tab, then assign each ministry's ministers here."
              : "No committees yet. Allocate participants to committees on the Allocation tab, then assign each committee's ministers here."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.committees.map((row) => (
              <div
                key={row.committee}
                className="rounded-lg border bg-card p-3 shadow-sm"
              >
                <div className="mb-2 min-w-0 truncate font-medium text-sm">
                  {row.committee}
                </div>
                <div className="space-y-2">
                  {renderSeat(row, "cabinet")}
                  {renderSeat(row, "shadow")}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
