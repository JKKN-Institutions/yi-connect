"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  Loader2,
  Plus,
  Trash2,
  Flag,
  Boxes,
  Phone,
  UserCog,
  AlertCircle,
} from "lucide-react";
import {
  assignYuvaToParty,
  assignYuvaToCommittee,
  removeYuvaAssignment,
  type YuvaAssignment,
} from "@/app/yip/actions/yuva-assignments";

type YuvaVolunteer = { id: string; full_name: string; phone: string | null };
type PartyLite = {
  id: string;
  name: string;
  side: string;
  party_number: number;
};

const SIDE_LABEL: Record<string, string> = {
  ruling: "Ruling",
  opposition: "Opposition",
};

export function YuvaAssignmentsClient({
  eventId,
  eventName,
  yuvaVolunteers,
  parties,
  committees,
  initialAssignments,
  canManage,
}: {
  eventId: string;
  eventName: string;
  yuvaVolunteers: YuvaVolunteer[];
  parties: PartyLite[];
  committees: string[];
  initialAssignments: YuvaAssignment[];
  canManage: boolean;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Assignment form state.
  const [volId, setVolId] = useState("");
  const [target, setTarget] = useState(""); // "party:<id>" or "committee:<name>"

  const volName = useMemo(
    () => new Map(yuvaVolunteers.map((v) => [v.id, v.full_name])),
    [yuvaVolunteers]
  );

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2200);
  }

  function submit() {
    setError(null);
    if (!volId) {
      setError("Pick a YUVA volunteer");
      return;
    }
    if (!target) {
      setError("Pick a party or committee");
      return;
    }
    startTransition(async () => {
      const [kind, ...rest] = target.split(":");
      const value = rest.join(":");
      const res =
        kind === "party"
          ? await assignYuvaToParty(eventId, volId, value)
          : await assignYuvaToCommittee(eventId, volId, value);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAssignments((prev) => [...prev, res.data]);
      setTarget("");
      showFlash(`Assigned ${volName.get(volId) ?? "YUVA"}`);
    });
  }

  function remove(assignment: YuvaAssignment) {
    startTransition(async () => {
      const res = await removeYuvaAssignment(assignment.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      showFlash("Removed");
    });
  }

  // Group assignments for the "who handles what" view.
  const byParty = useMemo(() => {
    const m = new Map<string, YuvaAssignment[]>();
    for (const a of assignments) {
      if (!a.party_id) continue;
      const key = a.party_name ?? a.party_id;
      m.set(key, [...(m.get(key) ?? []), a]);
    }
    return m;
  }, [assignments]);

  const byCommittee = useMemo(() => {
    const m = new Map<string, YuvaAssignment[]>();
    for (const a of assignments) {
      if (!a.committee_name) continue;
      m.set(a.committee_name, [...(m.get(a.committee_name) ?? []), a]);
    }
    return m;
  }, [assignments]);

  const sortedParties = useMemo(
    () =>
      [...parties].sort(
        (a, b) =>
          a.side.localeCompare(b.side) || a.party_number - b.party_number
      ),
    [parties]
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1a1a3e]">
          <UserCog className="size-6 text-[#FF9933]" />
          YUVA Desks
        </h1>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">
          Assign YUVA volunteers to the parties and committees they handle for{" "}
          <span className="font-medium">{eventName}</span>. Students later see
          their YUVA contact based on this.
        </p>
      </div>

      {flash && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {/* Assignment form */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign a YUVA</CardTitle>
          </CardHeader>
          <CardContent>
            {yuvaVolunteers.length === 0 ? (
              <p className="text-sm text-[#1a1a3e]/60">
                No YUVA volunteers yet. Add them on the{" "}
                <span className="font-medium">Volunteers</span> tab first
                (mark them as YUVA).
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm">
                  <span className="mb-1 block font-medium text-[#1a1a3e]/70">
                    YUVA volunteer
                  </span>
                  <select
                    value={volId}
                    onChange={(e) => setVolId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 text-sm"
                  >
                    <option value="">Select a YUVA…</option>
                    {yuvaVolunteers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name}
                        {v.phone ? ` · ${v.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex-1 text-sm">
                  <span className="mb-1 block font-medium text-[#1a1a3e]/70">
                    Party or committee
                  </span>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 text-sm"
                  >
                    <option value="">Select…</option>
                    {sortedParties.length > 0 && (
                      <optgroup label="Parties">
                        {sortedParties.map((p) => (
                          <option key={p.id} value={`party:${p.id}`}>
                            #{p.party_number} {p.name} (
                            {SIDE_LABEL[p.side] ?? p.side})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {committees.length > 0 && (
                      <optgroup label="Committees">
                        {committees.map((c) => (
                          <option key={c} value={`committee:${c}`}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>

                <Button onClick={submit} disabled={pending} className="shrink-0">
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Assign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Who handles each party */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="size-4 text-[#FF9933]" />
            Parties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedParties.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/60">No parties yet.</p>
          ) : (
            sortedParties.map((p) => {
              const handlers = byParty.get(p.name) ?? [];
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#1a1a3e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{p.party_number}</Badge>
                    <span className="font-medium text-[#1a1a3e]">{p.name}</span>
                    <span className="text-xs text-[#1a1a3e]/50">
                      {SIDE_LABEL[p.side] ?? p.side}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {handlers.length === 0 ? (
                      <span className="text-xs text-[#1a1a3e]/40">
                        No YUVA assigned
                      </span>
                    ) : (
                      handlers.map((h) => (
                        <HandlerChip
                          key={h.id}
                          assignment={h}
                          canManage={canManage}
                          pending={pending}
                          onRemove={remove}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Who handles each committee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="size-4 text-[#FF9933]" />
            Committees
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {committees.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/60">No committees yet.</p>
          ) : (
            committees.map((c) => {
              const handlers = byCommittee.get(c) ?? [];
              return (
                <div
                  key={c}
                  className="flex flex-col gap-2 rounded-lg border border-[#1a1a3e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-[#1a1a3e]">{c}</span>
                  <div className="flex flex-wrap gap-2">
                    {handlers.length === 0 ? (
                      <span className="text-xs text-[#1a1a3e]/40">
                        No YUVA assigned
                      </span>
                    ) : (
                      handlers.map((h) => (
                        <HandlerChip
                          key={h.id}
                          assignment={h}
                          canManage={canManage}
                          pending={pending}
                          onRemove={remove}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HandlerChip({
  assignment,
  canManage,
  pending,
  onRemove,
}: {
  assignment: YuvaAssignment;
  canManage: boolean;
  pending: boolean;
  onRemove: (a: YuvaAssignment) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#138808]/10 py-1 pl-3 pr-1.5 text-sm text-[#138808]">
      <span className="font-medium">{assignment.volunteer_name}</span>
      {assignment.volunteer_phone && (
        <span className="inline-flex items-center gap-0.5 text-xs text-[#138808]/70">
          <Phone className="size-3" />
          {assignment.volunteer_phone}
        </span>
      )}
      {canManage && (
        <button
          type="button"
          aria-label={`Remove ${assignment.volunteer_name}`}
          disabled={pending}
          onClick={() => onRemove(assignment)}
          className="ml-0.5 rounded-full p-0.5 text-[#138808]/60 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </span>
  );
}
