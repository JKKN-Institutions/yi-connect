"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Flag,
  Crown,
  ArrowLeft,
  ArrowRightLeft,
  Users,
  Hash,
  Wand2,
  Lock,
} from "lucide-react";
import {
  createParty,
  updateParty,
  deleteParty,
  assignParticipantsToParty,
  electPartyLeader,
  formParties,
  type Party,
  type FormPartiesSummary,
} from "@/app/yip/actions/parties";
import { splitBenchParties } from "@/lib/yip/party-formation";
import { assignCommittees } from "@/app/yip/actions/allocation";

type Participant = {
  id: string;
  full_name: string;
  school_name: string;
  party_side: string | null;
  party_id: string | null;
  parliament_role: string | null;
};

type FormState = {
  side: "ruling" | "opposition";
  party_number: number;
  name: string;
  symbol_url: string;
  tagline: string;
  manifesto: string[]; // 4 points
};

const EMPTY_FORM: FormState = {
  side: "ruling",
  party_number: 1,
  name: "",
  symbol_url: "",
  tagline: "",
  manifesto: ["", "", "", ""],
};

export function PartiesClient({
  eventId,
  eventName,
  initialParties,
  participants,
  canDelete = true,
  canManage = false,
  allocationLocked = false,
}: {
  eventId: string;
  eventName: string;
  initialParties: Party[];
  participants: Participant[];
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
  /** Organiser-or-above. Gates the auto Form Parties tool (server re-checks). */
  canManage?: boolean;
  /** When locked, role & party changes are disabled. */
  allocationLocked?: boolean;
}) {
  const router = useRouter();
  const [parties, setParties] = useState(initialParties);
  const [editing, setEditing] = useState<Party | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [formPartyCount, setFormPartyCount] = useState(5);
  const [assignLeaders, setAssignLeaders] = useState(false);
  const [formResult, setFormResult] = useState<FormPartiesSummary | null>(null);

  function handleFormParties() {
    const rulingN = participants.filter((p) => p.party_side === "ruling").length;
    const oppositionN = participants.filter((p) => p.party_side === "opposition").length;
    const split = splitBenchParties(formPartyCount, rulingN, oppositionN);
    const ok = confirm(
      `Creates ${formPartyCount} parties and distributes all ${participants.length} students across them with school spread; bench split ${split.ruling} Ruling / ${split.opposition} Opposition. Continue?`
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await formParties(eventId, formPartyCount, assignLeaders);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setError(null);
      setParties(res.data.parties);
      setFormResult(res.data);
      setFlash(`Formed ${res.data.parties.length} parties`);
      setTimeout(() => setFlash(null), 2500);
      // Refresh server props so member counts on the party cards are live.
      router.refresh();
    });
  }

  function handleAssignCommittees() {
    const ok = confirm(
      "Re-assign committees: students are spread evenly across committees by party (mixed committees). Only the Speaker and Deputy Speakers are excluded (they preside). Parties are NOT changed. Continue?"
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await assignCommittees(eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setError(null);
      setFlash(
        `Committees re-balanced — ${res.data.committees.length} committees, ${res.data.excluded} office-holders excluded`
      );
      setTimeout(() => setFlash(null), 3000);
      router.refresh();
    });
  }

  // Party numbers are unique per EVENT (across both benches) — see
  // parties_event_id_party_number_key. Computing per-side suggested numbers
  // that already exist on the other bench and the insert failed (BUG-388).
  function nextPartyNumber(): number {
    const nums = parties.map((p) => p.party_number);
    let n = 1;
    while (nums.includes(n)) n += 1;
    return n;
  }

  // Existing events name parties "Party A", "Party B", … by number.
  // Suggest the matching name; the organizer can still overwrite it.
  function suggestedPartyName(n: number): string {
    const lettered =
      n >= 1 && n <= 26 ? `Party ${String.fromCharCode(64 + n)}` : `Party ${n}`;
    if (!parties.some((p) => p.name === lettered)) return lettered;
    const numbered = `Party ${n}`;
    if (!parties.some((p) => p.name === numbered)) return numbered;
    return "";
  }

  function openCreate(side: "ruling" | "opposition") {
    const n = nextPartyNumber();
    setForm({ ...EMPTY_FORM, side, party_number: n, name: suggestedPartyName(n) });
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(p: Party) {
    setForm({
      side: p.side,
      party_number: p.party_number,
      name: p.name,
      symbol_url: p.symbol_url ?? "",
      tagline: p.tagline ?? "",
      manifesto: [
        p.manifesto[0] ?? "",
        p.manifesto[1] ?? "",
        p.manifesto[2] ?? "",
        p.manifesto[3] ?? "",
      ],
    });
    setEditing(p);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  function submit() {
    if (!form.name.trim()) {
      setError("Party name is required.");
      return;
    }

    const payload = {
      event_id: eventId,
      side: form.side,
      party_number: form.party_number,
      name: form.name.trim(),
      symbol_url: form.symbol_url.trim() || null,
      tagline: form.tagline.trim() || null,
      manifesto: form.manifesto.map((m) => m.trim()).filter((m) => m.length > 0),
    };

    startTransition(async () => {
      if (editing) {
        const res = await updateParty(editing.id, payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setParties((prev) =>
          prev.map((p) => (p.id === editing.id ? res.data : p))
        );
        setFlash(`Updated ${payload.name}`);
      } else {
        const res = await createParty(payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setParties((prev) => [...prev, res.data]);
        setFlash(`Created ${payload.name}`);
      }
      closeForm();
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function handleDelete(p: Party) {
    if (!confirm(`Delete "${p.name}"? Assigned participants will lose their party link.`))
      return;
    startTransition(async () => {
      const res = await deleteParty(p.id, eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setParties((prev) => prev.filter((x) => x.id !== p.id));
      setFlash(`Removed ${p.name}`);
      setTimeout(() => setFlash(null), 2500);
    });
  }

  /** Move a party (and its assigned members) to the other bench. BUG-401. */
  function handleMove(p: Party) {
    const target: "ruling" | "opposition" =
      p.side === "ruling" ? "opposition" : "ruling";
    startTransition(async () => {
      const res = await updateParty(p.id, { side: target });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setError(null);
      setParties((prev) => prev.map((x) => (x.id === p.id ? res.data : x)));
      setFlash(
        `Moved ${p.name} to the ${target === "ruling" ? "Ruling" : "Opposition"} Bench`
      );
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function openAssign(partyId: string) {
    const party = parties.find((p) => p.id === partyId);
    if (!party) return;
    const eligible = participants.filter(
      (pt) => pt.party_side === party.side || pt.party_side === null
    );
    setAssignOpen(partyId);
    setPicked(new Set(eligible.filter((pt) => pt.party_id === partyId).map((pt) => pt.id)));
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commitAssign() {
    if (!assignOpen) return;
    const ids = Array.from(picked);
    startTransition(async () => {
      const res = await assignParticipantsToParty(assignOpen, ids);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(`Assigned ${ids.length} participants`);
      setAssignOpen(null);
      setTimeout(() => setFlash(null), 2500);
      // Page refreshes via revalidatePath; the participant.party_id will be updated on next fetch.
    });
  }

  function handleElectLeader(partyId: string, participantId: string) {
    startTransition(async () => {
      const res = await electPartyLeader(partyId, participantId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setParties((prev) =>
        prev.map((p) =>
          p.id === partyId ? { ...p, party_leader_id: participantId } : p
        )
      );
      setFlash("Party Leader elected");
      setTimeout(() => setFlash(null), 2500);
    });
  }

  const ruling = parties.filter((p) => p.side === "ruling");
  const opposition = parties.filter((p) => p.side === "opposition");

  const partyForAssign = assignOpen ? parties.find((p) => p.id === assignOpen) : null;
  const eligibleForAssign = partyForAssign
    ? participants.filter(
        (pt) => pt.party_side === partyForAssign.side || pt.party_side === null
      )
    : [];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <Link
            href={`/yip/dashboard/events/${eventId}`}
            className="inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e] mb-2"
          >
            <ArrowLeft className="size-3" /> {eventName}
          </Link>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight">
            Political Parties
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Student-created parties with manifesto &amp; symbol · Handbook page 14
          </p>
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {error && !creating && !editing && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Auto Form Parties (organiser tool) */}
      {canManage && (
        <FormPartiesCard
          participants={participants}
          parties={parties}
          allocationLocked={allocationLocked}
          partyCount={formPartyCount}
          onPartyCountChange={setFormPartyCount}
          onRun={handleFormParties}
          pending={pending}
          result={formResult}
          assignLeaders={assignLeaders}
          onAssignLeadersChange={setAssignLeaders}
        />
      )}

      {/* Assign / Re-balance Committees (mixed cross-party, party-balanced) */}
      {canManage && (
        <Card>
          <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1a1a3e]">Committees</h3>
              <p className="text-xs text-[#1a1a3e]/60 mt-0.5 max-w-md">
                Spread students evenly across committees by party (mixed
                committees). Only the Speaker &amp; Deputy Speakers are excluded —
                they preside. Run after forming parties; re-running won&apos;t
                change parties.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleAssignCommittees}
              disabled={pending || allocationLocked}
            >
              Assign / Re-balance Committees
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {(creating || editing) && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-lg">
              {editing ? `Edit: ${editing.name}` : `Add Party to ${form.side === "ruling" ? "Ruling" : "Opposition"} Bench`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Side *</label>
                {editing ? (
                  // Editable while editing so a party can be moved between
                  // benches (BUG-401). Members move with the party.
                  <select
                    value={form.side}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        side: e.target.value as "ruling" | "opposition",
                      })
                    }
                    className="w-full border border-input rounded-md px-3 py-2 text-sm"
                  >
                    <option value="ruling">Ruling Bench</option>
                    <option value="opposition">Opposition Bench</option>
                  </select>
                ) : (
                  // Pre-assigned from the bench whose "Add Party" was clicked
                  // — no manual side choice when adding (BUG-388).
                  <div className="w-full border border-input rounded-md px-3 py-2 text-sm bg-gray-50 text-[#1a1a3e]/80">
                    {form.side === "ruling" ? "Ruling Bench" : "Opposition Bench"}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Party Number *</label>
                <Input
                  type="number"
                  min={1}
                  value={form.party_number}
                  onChange={(e) => {
                    const n = parseInt(e.target.value) || 1;
                    setForm((f) => ({
                      ...f,
                      party_number: n,
                      // Auto-populate the name from the number while adding,
                      // unless the organizer already typed their own name.
                      name:
                        !editing &&
                        (f.name === "" || f.name === suggestedPartyName(f.party_number))
                          ? suggestedPartyName(n)
                          : f.name,
                    }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bharat Progressive Front"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Symbol URL</label>
                <Input
                  value={form.symbol_url}
                  onChange={(e) => setForm({ ...form, symbol_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Tagline</label>
                <Input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Youth First"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                4-Point Manifesto *
              </label>
              <div className="space-y-2 mt-1">
                {[0, 1, 2, 3].map((i) => (
                  <Textarea
                    key={i}
                    value={form.manifesto[i]}
                    onChange={(e) => {
                      const next = [...form.manifesto];
                      next[i] = e.target.value;
                      setForm({ ...form, manifesto: next });
                    }}
                    placeholder={`Plank ${i + 1}`}
                    rows={2}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeForm} disabled={pending}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={pending}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {editing
                  ? "Save Changes"
                  : `Add Party to ${form.side === "ruling" ? "Ruling" : "Opposition"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign modal */}
      {assignOpen && partyForAssign && (
        <Card className="border-blue-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="size-4" />
              Assign participants to {partyForAssign.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              {eligibleForAssign.length === 0 ? (
                <p className="text-sm text-[#1a1a3e]/50 p-6 text-center">
                  No eligible participants. Assign party side in Allocation first.
                </p>
              ) : (
                eligibleForAssign.map((pt) => (
                  <label
                    key={pt.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(pt.id)}
                      onChange={() => togglePick(pt.id)}
                      className="size-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{pt.full_name}</div>
                    </div>
                    {pt.party_id && pt.party_id !== partyForAssign.id && (
                      <Badge variant="secondary" className="text-[10px]">
                        In another party
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#1a1a3e]/70">
                {picked.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAssignOpen(null)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  onClick={commitAssign}
                  disabled={pending}
                  className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
                >
                  {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Assign {picked.size}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PartyBench
          title="Ruling Bench"
          color="blue"
          parties={ruling}
          participants={participants}
          onCreate={() => openCreate("ruling")}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMove={handleMove}
          movePending={pending}
          onAssign={openAssign}
          onElect={handleElectLeader}
          canDelete={canDelete}
        />
        <PartyBench
          title="Opposition Bench"
          color="red"
          parties={opposition}
          participants={participants}
          onCreate={() => openCreate("opposition")}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMove={handleMove}
          movePending={pending}
          onAssign={openAssign}
          onElect={handleElectLeader}
          canDelete={canDelete}
        />
      </div>
    </div>
  );
}

function FormPartiesCard({
  participants,
  parties,
  allocationLocked,
  partyCount,
  onPartyCountChange,
  onRun,
  pending,
  result,
  assignLeaders,
  onAssignLeadersChange,
}: {
  participants: Participant[];
  parties: Party[];
  allocationLocked: boolean;
  partyCount: number;
  onPartyCountChange: (n: number) => void;
  onRun: () => void;
  pending: boolean;
  result: FormPartiesSummary | null;
  assignLeaders: boolean;
  onAssignLeadersChange: (v: boolean) => void;
}) {
  const rulingN = participants.filter((p) => p.party_side === "ruling").length;
  const oppositionN = participants.filter((p) => p.party_side === "opposition").length;
  const missingBench = participants.length - rulingN - oppositionN;
  const anyMembers = participants.some((p) => p.party_id != null);

  // Mirror of the server-side refusals so the organiser sees WHY up front
  // (the server action re-checks everything — this is display only).
  let blocked: string | null = null;
  if (parties.length > 0) {
    blocked = anyMembers
      ? "Parties already formed — delete existing parties first to use auto-form."
      : `This event already has ${parties.length} part${
          parties.length === 1 ? "y" : "ies"
        } with no members — delete them first to use auto-form.`;
  } else if (allocationLocked) {
    blocked = "Unlock allocation first — party changes are locked.";
  } else if (participants.length === 0) {
    blocked = "No participants registered yet.";
  } else if (missingBench > 0) {
    blocked = `${missingBench} of ${participants.length} students have no bench (ruling/opposition) yet — run Allocation first.`;
  }

  const split = !blocked
    ? splitBenchParties(partyCount, rulingN, oppositionN)
    : null;

  return (
    <Card className="border-[#138808]/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wand2 className="size-4 text-[#138808]" />
          Form Parties
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#1a1a3e]/70">
          Automatically creates the parties and distributes every student across
          them — party sizes stay balanced and classmates from the same school
          are spread out (handbook model; the chair sets the party count).
        </p>

        {blocked ? (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <Lock className="size-4 mt-0.5 shrink-0" />
            <span>{blocked}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70 block mb-1">
                Number of parties
              </label>
              <select
                value={partyCount}
                onChange={(e) => onPartyCountChange(parseInt(e.target.value))}
                className="border border-input rounded-md px-3 py-2 text-sm"
                disabled={pending}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} parties
                  </option>
                ))}
              </select>
            </div>
            {split && (
              <div className="text-xs text-[#1a1a3e]/60 pb-2.5">
                Bench split: <span className="font-medium text-blue-700">{split.ruling} Ruling</span>
                {" / "}
                <span className="font-medium text-red-700">{split.opposition} Opposition</span>
                {" · "}
                {participants.length} students ({rulingN}/{oppositionN})
              </div>
            )}
            <Button
              onClick={onRun}
              disabled={pending}
              className="bg-[#138808] hover:bg-[#138808]/90 text-white"
            >
              {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Form {partyCount} Parties
            </Button>
            <label className="flex w-full max-w-md cursor-pointer items-start gap-2 text-left text-xs text-[#1a1a3e]/70">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#138808]"
                checked={assignLeaders}
                disabled={pending}
                onChange={(e) => onAssignLeadersChange(e.target.checked)}
              />
              <span>
                <span className="font-medium text-[#1a1a3e]">
                  Also auto-assign a party leader for each party
                </span>{" "}
                — the senior-most member of each party. Optional; leave off to
                let students elect their leaders.
              </span>
            </label>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-[#138808]/20 bg-[#138808]/5 p-3 space-y-2">
            <div className="text-sm font-medium text-[#1a1a3e]">
              Done — {result.parties.length} parties formed (
              {result.benchSplit.ruling} Ruling / {result.benchSplit.opposition}{" "}
              Opposition)
            </div>
            <div className="flex flex-wrap gap-2">
              {result.counts.map((c) => (
                <Badge
                  key={c.name}
                  variant="secondary"
                  className={`text-[11px] ${
                    c.side === "ruling" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {c.name}: {c.members}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-[#1a1a3e]/60">
              Max students from one school in a single party:{" "}
              {result.maxSameSchoolPerParty}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PartyBench({
  title,
  color,
  parties,
  participants,
  onCreate,
  onEdit,
  onDelete,
  onMove,
  movePending = false,
  onAssign,
  onElect,
  canDelete = true,
}: {
  title: string;
  color: "blue" | "red";
  parties: Party[];
  participants: Participant[];
  onCreate: () => void;
  onEdit: (p: Party) => void;
  onDelete: (p: Party) => void;
  onMove: (p: Party) => void;
  movePending?: boolean;
  onAssign: (partyId: string) => void;
  onElect: (partyId: string, participantId: string) => void;
  canDelete?: boolean;
}) {
  const moveLabel = color === "blue" ? "Move to Opposition" : "Move to Ruling";
  const accentBg = color === "blue" ? "bg-blue-50" : "bg-red-50";
  const accentBorder = color === "blue" ? "border-blue-200" : "border-red-200";
  const accentText = color === "blue" ? "text-blue-700" : "text-red-700";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className={`size-4 ${accentText}`} />
          <h2 className={`text-lg font-semibold ${accentText}`}>{title}</h2>
          <span className="text-xs text-[#1a1a3e]/50">({parties.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus className="size-3 mr-1" /> Add Party
        </Button>
      </div>

      {parties.length === 0 && (
        <div className={`rounded-lg border-2 border-dashed ${accentBorder} ${accentBg} p-8 text-center text-sm text-[#1a1a3e]/60`}>
          No parties yet on this bench.
        </div>
      )}

      {parties.map((p) => {
        const members = participants.filter((pt) => pt.party_id === p.id);
        const leader = p.party_leader_id
          ? participants.find((pt) => pt.id === p.party_leader_id)
          : null;

        return (
          <Card key={p.id} className={accentBorder}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {p.symbol_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.symbol_url}
                      alt={p.name}
                      className="size-10 rounded object-contain bg-white border"
                    />
                  ) : (
                    <div className={`size-10 rounded ${accentBg} ${accentBorder} border flex items-center justify-center`}>
                      <Hash className={`size-4 ${accentText}`} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        #{p.party_number}
                      </Badge>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                    {p.tagline && (
                      <p className="text-xs text-[#1a1a3e]/60 mt-0.5">{p.tagline}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMove(p)}
                    disabled={movePending}
                    title={`${moveLabel} Bench — assigned members move with the party`}
                  >
                    <ArrowRightLeft className="size-3 mr-1" />
                    {moveLabel}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onEdit(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(p)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              {p.manifesto.length > 0 && (
                <ol className="text-xs text-[#1a1a3e]/75 space-y-1 pl-4 list-decimal">
                  {p.manifesto.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ol>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-[#1a1a3e]/70">
                  <Users className="size-3 inline mr-1" />
                  {members.length} member{members.length === 1 ? "" : "s"}
                  {leader && (
                    <span className="ml-2">
                      <Crown className="size-3 inline mr-0.5 text-amber-500" />
                      {leader.full_name}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onAssign(p.id)}>
                    Assign
                  </Button>
                  {members.length > 0 && !leader && (
                    <select
                      onChange={(e) => e.target.value && onElect(p.id, e.target.value)}
                      defaultValue=""
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="">Elect leader…</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
