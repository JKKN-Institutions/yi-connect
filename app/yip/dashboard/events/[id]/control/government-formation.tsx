"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Landmark, Users, Check } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { PARTY_COLORS, type PartySide } from "@/lib/yip/constants";
import { getGovtFormationParties, updateParty } from "@/app/yip/actions/parties";
import { toast } from "sonner";

type GovtParty = {
  id: string;
  party_number: number;
  name: string;
  side: PartySide | null;
  members: number;
};

interface GovernmentFormationPanelProps {
  eventId: string;
}

export function GovernmentFormationPanel({
  eventId,
}: GovernmentFormationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [parties, setParties] = useState<GovtParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const rows = await getGovtFormationParties(eventId);
    setParties(rows);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchAll();
    // Light poll so the panel reflects edits made elsewhere; skipped via the
    // savingId guard below while a change is mid-flight.
    const interval = setInterval(() => {
      fetchAll();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  function setSide(party: GovtParty, side: PartySide | null) {
    if (party.side === side) return;
    setSavingId(party.id);
    // Optimistic update so the bench colours flip instantly on the big screen.
    setParties((prev) =>
      prev.map((p) => (p.id === party.id ? { ...p, side } : p))
    );
    startTransition(async () => {
      const result = await updateParty(party.id, { side });
      if (!result.success) {
        toast.error(result.error);
        await fetchAll(); // revert to truth
      } else {
        const label =
          side === "ruling"
            ? "Ruling bench"
            : side === "opposition"
              ? "Opposition bench"
              : "no bench";
        toast.success(`${party.name} → ${label}`);
        await fetchAll();
      }
      setSavingId(null);
    });
  }

  const rulingMembers = parties
    .filter((p) => p.side === "ruling")
    .reduce((sum, p) => sum + p.members, 0);
  const oppositionMembers = parties
    .filter((p) => p.side === "opposition")
    .reduce((sum, p) => sum + p.members, 0);
  const unassigned = parties.filter((p) => p.side === null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Landmark className="size-4" />
          Government Formation
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Move each party to the Ruling or Opposition bench. Members follow their
          party automatically.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className={cn("gap-1", PARTY_COLORS.ruling.badge)}>
            <Users className="size-3" />
            Ruling · {rulingMembers}
          </Badge>
          <Badge className={cn("gap-1", PARTY_COLORS.opposition.badge)}>
            <Users className="size-3" />
            Opposition · {oppositionMembers}
          </Badge>
          {unassigned > 0 && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              {unassigned} not set
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading parties…
          </p>
        ) : parties.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No parties found for this event.
          </p>
        ) : (
          parties.map((party) => {
            const colors =
              party.side === "ruling"
                ? PARTY_COLORS.ruling
                : party.side === "opposition"
                  ? PARTY_COLORS.opposition
                  : null;
            const saving = savingId === party.id && isPending;
            return (
              <div
                key={party.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                  colors ? cn(colors.bg, colors.border) : "border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium",
                      colors ? colors.text : "text-foreground"
                    )}
                  >
                    {party.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {party.members} {party.members === 1 ? "member" : "members"}
                  </span>
                  {saving && (
                    <span className="text-xs text-muted-foreground">saving…</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={party.side === "ruling" ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => setSide(party, "ruling")}
                    className={cn(
                      party.side === "ruling" && PARTY_COLORS.ruling.badge
                    )}
                  >
                    {party.side === "ruling" && <Check className="size-3" />}
                    Ruling
                  </Button>
                  <Button
                    size="sm"
                    variant={party.side === "opposition" ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => setSide(party, "opposition")}
                    className={cn(
                      party.side === "opposition" && PARTY_COLORS.opposition.badge
                    )}
                  >
                    {party.side === "opposition" && <Check className="size-3" />}
                    Opposition
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending || party.side === null}
                    onClick={() => setSide(party, null)}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
