"use client";

/**
 * Formation step 6 — Appointments (organiser picks, no ballots).
 *
 * Cabinet & Shadow Ministers (with a ministry), Deputy Ministers, and the two
 * duty officials (Parliamentary Administrator / Journalist). Bench rules are
 * enforced server-side in appointFormationRole (fail closed); this panel also
 * pre-filters the picker to the right bench so organisers rarely see a denial.
 *
 * The three RR role keys are runtime strings (C3): until the user-run enum
 * script lands, appointing one surfaces the explicit "role not yet enabled"
 * error from the server — never a silent failure.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Label } from "@/components/yip/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/yip/ui/select";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { SearchablePersonSelect } from "@/components/yip/searchable-person-select";
import type { MinistryPortfolio } from "@/lib/yip/cabinet";
import { FORMATION_APPOINTED_ROLES } from "@/lib/yip/formation";
import { getEventParticipants } from "@/app/yip/actions/participants";
import { ParticipantNameButton } from "@/components/yip/participant-profile-dialog";
import {
  appointFormationRole,
  clearFormationRole,
} from "@/app/yip/actions/formation-appointments";

type ParticipantLite = {
  id: string;
  full_name: string;
  school_name: string | null;
  parliament_role: string | null;
  party_side: string | null;
  cabinet_portfolios: string[] | null;
};

export function AppointmentsPanel({
  eventId,
  eventName,
  ministries,
  disabled,
}: {
  eventId: string;
  eventName: string;
  ministries: MinistryPortfolio[];
  disabled: boolean;
}) {
  const [people, setPeople] = useState<ParticipantLite[] | null>(null);
  const [roleKey, setRoleKey] = useState<string>(
    FORMATION_APPOINTED_ROLES[0].key
  );
  const [personId, setPersonId] = useState("");
  const [ministry, setMinistry] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const rows = await getEventParticipants(eventId);
    setPeople(
      (rows as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        full_name: String(r.full_name ?? ""),
        school_name: (r.school_name as string | null) ?? null,
        parliament_role: (r.parliament_role as string | null) ?? null,
        party_side: (r.party_side as string | null) ?? null,
        cabinet_portfolios: (r.cabinet_portfolios as string[] | null) ?? null,
      }))
    );
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleDef = FORMATION_APPOINTED_ROLES.find((r) => r.key === roleKey);

  // Pre-filter the picker to the role's bench (server re-checks, fail closed).
  const eligible = (people ?? []).filter(
    (p) => !roleDef?.side || p.party_side === roleDef.side
  );

  const holders = (people ?? []).filter((p) =>
    FORMATION_APPOINTED_ROLES.some((r) => r.key === p.parliament_role)
  );

  function handleAppoint() {
    if (!roleDef) return;
    if (!personId) {
      toast.error("Pick a participant first.");
      return;
    }
    if (roleDef.needsMinistry && !ministry) {
      toast.error(`Pick a ministry for the ${roleDef.label}.`);
      return;
    }
    startTransition(async () => {
      const res = await appointFormationRole(
        eventId,
        personId,
        roleDef.key,
        roleDef.needsMinistry ? ministry : undefined
      );
      if (res.success) {
        toast.success(`${roleDef.label} appointed.`);
        setPersonId("");
        setMinistry("");
        await load();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleClear(p: ParticipantLite) {
    startTransition(async () => {
      const res = await clearFormationRole(eventId, p.id);
      if (res.success) {
        toast.success(`${p.full_name} is back to Member.`);
        await load();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (people === null) {
    return (
      <p className="flex items-center gap-2 text-xs text-[#1a1a3e]/50">
        <Loader2 className="size-3.5 animate-spin" /> Loading participants…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Appoint controls */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Role</Label>
          <Select
            value={roleKey}
            onValueChange={(v) => {
              if (!v) return;
              setRoleKey(v);
              setPersonId("");
              setMinistry("");
            }}
            disabled={disabled || isPending}
          >
            <SelectTrigger className="h-8 w-[210px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATION_APPOINTED_ROLES.map((r) => (
                <SelectItem key={r.key} value={r.key} className="text-xs">
                  {r.label}
                  {r.side ? ` (${r.side})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label className="text-xs">Participant</Label>
          <SearchablePersonSelect
            options={eligible.map((p) => ({
              id: p.id,
              label: p.full_name,
              sublabel:
                p.parliament_role && p.parliament_role !== "mp"
                  ? p.parliament_role.replace(/_/g, " ")
                  : (p.school_name ?? undefined),
            }))}
            value={personId}
            onChange={setPersonId}
            placeholder="Type a name…"
            disabled={disabled || isPending}
          />
        </div>
        {roleDef?.needsMinistry && (
          <div className="space-y-1.5">
            <Label className="text-xs">Ministry</Label>
            <Select
              value={ministry}
              onValueChange={(v) => setMinistry(v ?? "")}
              disabled={disabled || isPending}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Pick a ministry" />
              </SelectTrigger>
              <SelectContent>
                {ministries.map((m) => (
                  <SelectItem key={m.key} value={m.label} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          size="sm"
          onClick={handleAppoint}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserPlus className="size-3.5" />
          )}
          Appoint
        </Button>
      </div>

      {/* Current appointees */}
      {holders.length === 0 ? (
        <p className="text-xs text-[#1a1a3e]/50">
          No appointments yet — Cabinet, Shadow Cabinet, Deputy Ministers and
          Officials appear here as you appoint them.
        </p>
      ) : (
        <ul className="divide-y divide-[#1a1a3e]/5 rounded-md border border-[#1a1a3e]/10">
          {holders.map((p) => {
            const def = FORMATION_APPOINTED_ROLES.find(
              (r) => r.key === p.parliament_role
            );
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1a1a3e]">
                    <ParticipantNameButton
                      eventId={eventId}
                      eventName={eventName}
                      participantId={p.id}
                      name={p.full_name}
                      className="text-left underline-offset-4 hover:underline"
                    />
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {def?.label ?? p.parliament_role}
                    </Badge>
                    {(p.cabinet_portfolios ?? []).map((m) => (
                      <Badge
                        key={m}
                        variant="outline"
                        className="text-[10px] text-[#1a1a3e]/60"
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-[#1a1a3e]/60"
                  onClick={() => handleClear(p)}
                  disabled={disabled || isPending}
                >
                  <UserMinus className="size-3.5" /> Clear
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
