"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import {
  Landmark,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  /**
   * True while the live agenda is on the "Government & Opposition Formation"
   * session. When true the panel auto-expands and is highlighted, but the
   * panel is rendered (collapsed) at all other times too so the bench split
   * can be corrected at any point in the event.
   */
  isActiveSession?: boolean;
}

export function GovernmentFormationPanel({
  eventId,
  isActiveSession = false,
}: GovernmentFormationPanelProps) {
  const [parties, setParties] = useState<GovtParty[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-party in-flight set so each row locks independently — the Director can
  // assign benches in quick succession without the whole panel freezing.
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<boolean>(isActiveSession);

  const fetchAll = useCallback(async () => {
    const rows = await getGovtFormationParties(eventId);
    // getGovtFormationParties returns [] on a transient read error too, so never
    // let an empty result wipe a list we already have (would blank the panel
    // mid-event). A genuinely empty event still shows the empty state on first load.
    setParties((prev) => (rows.length === 0 && prev.length > 0 ? prev : rows));
    setLoading(false);
  }, [eventId]);

  // Always fetch once so the collapsed summary reflects the real split.
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-open when the formation session goes live (Director can still collapse).
  useEffect(() => {
    if (isActiveSession) setOpen(true);
  }, [isActiveSession]);

  // Poll only while expanded and while nothing is mid-save — a poll landing
  // between the optimistic flip and the server commit would briefly revert the
  // colour. Re-arms automatically once saves settle (savingIds in deps).
  useEffect(() => {
    if (!open || savingIds.size > 0) return;
    const interval = setInterval(() => {
      fetchAll();
    }, 15000);
    return () => clearInterval(interval);
  }, [open, savingIds, fetchAll]);

  async function setSide(party: GovtParty, side: PartySide | null) {
    if (party.side === side || savingIds.has(party.id)) return;
    setSavingIds((prev) => new Set(prev).add(party.id));
    // Optimistic update so the bench colours flip instantly on the big screen.
    setParties((prev) =>
      prev.map((p) => (p.id === party.id ? { ...p, side } : p))
    );
    const result = await updateParty(party.id, { side });
    if (!result.success) {
      toast.error(result.error);
    } else {
      const label =
        side === "ruling"
          ? "Ruling bench"
          : side === "opposition"
            ? "Opposition bench"
            : "no bench";
      toast.success(`${party.name} → ${label}`);
    }
    await fetchAll(); // reconcile to server truth (also reverts on failure)
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(party.id);
      return next;
    });
  }

  const rulingParties = parties.filter((p) => p.side === "ruling");
  const oppositionParties = parties.filter((p) => p.side === "opposition");
  const rulingMembers = rulingParties.reduce((sum, p) => sum + p.members, 0);
  const oppositionMembers = oppositionParties.reduce(
    (sum, p) => sum + p.members,
    0
  );
  const unassigned = parties.filter((p) => p.side === null).length;

  const summary =
    rulingParties.length === 0 && oppositionParties.length === 0
      ? "Benches not set yet"
      : [
          rulingParties.length > 0 &&
            `Ruling: ${rulingParties.map((p) => p.name).join(", ")}`,
          oppositionParties.length > 0 &&
            `Opposition: ${oppositionParties.map((p) => p.name).join(", ")}`,
        ]
          .filter(Boolean)
          .join("  ·  ");

  return (
    <Card className={cn(isActiveSession && "ring-2 ring-primary/40")}>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Landmark className="size-4" />
            Government Formation
            {isActiveSession && (
              <Badge className="bg-primary text-primary-foreground">
                Live now
              </Badge>
            )}
          </CardTitle>
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {/* Tally + summary are visible whether expanded or collapsed. */}
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
        {!open && !loading && (
          <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Move each party to the Ruling or Opposition bench. Members follow
            their party automatically. You can change this at any time during the
            event.
          </p>
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
              const saving = savingIds.has(party.id);
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
                      {party.members}{" "}
                      {party.members === 1 ? "member" : "members"}
                    </span>
                    {saving && (
                      <span className="text-xs text-muted-foreground">
                        saving…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={party.side === "ruling" ? "default" : "outline"}
                      disabled={saving}
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
                      variant={
                        party.side === "opposition" ? "default" : "outline"
                      }
                      disabled={saving}
                      onClick={() => setSide(party, "opposition")}
                      className={cn(
                        party.side === "opposition" &&
                          PARTY_COLORS.opposition.badge
                      )}
                    >
                      {party.side === "opposition" && (
                        <Check className="size-3" />
                      )}
                      Opposition
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={saving || party.side === null}
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
      )}
    </Card>
  );
}
