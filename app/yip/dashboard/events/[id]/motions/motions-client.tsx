"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Plus,
  Gavel,
  Loader2,
  Check,
  X,
  Trash2,
  Vote,
  MessageSquare,
} from "lucide-react";
import {
  MOTION_TYPES,
  MOTION_STATUS_LABELS,
  MOTION_STATUS_COLORS,
  motionMeta,
  isHouseVoteMotionType,
  type MotionType,
} from "@/lib/yip/motions";
import { MINISTRIES } from "@/lib/yip/constants";
import {
  createMotion,
  admitMotion,
  rejectMotion,
  recordMotionVote,
  organiserOpenMotionVote,
  recordMinisterResponse,
  deleteMotion,
  type Motion,
} from "@/app/yip/actions/motions";

type Participant = {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
};

type FormState = {
  motion_type: MotionType;
  raised_by_id: string;
  directed_to_ministry: string;
  subject: string;
  details: string;
};

const EMPTY_FORM: FormState = {
  motion_type: "adjournment",
  raised_by_id: "",
  directed_to_ministry: "",
  subject: "",
  details: "",
};

export function MotionsClient({
  eventId,
  eventName,
  initialMotions,
  participants,
  canDelete = true,
}: {
  eventId: string;
  eventName: string;
  initialMotions: Motion[];
  participants: Participant[];
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
}) {
  const [motions, setMotions] = useState(initialMotions);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [rulingId, setRulingId] = useState<string | null>(null);
  const [speakerNote, setSpeakerNote] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [votes, setVotes] = useState({ for: 0, against: 0, abstain: 0 });
  const [responseId, setResponseId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [filter, setFilter] = useState<MotionType | "all">("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [openingVoteId, setOpeningVoteId] = useState<string | null>(null);

  const filtered = filter === "all" ? motions : motions.filter((m) => m.motion_type === filter);

  function resetUI() {
    setRulingId(null);
    setSpeakerNote("");
    setVotingId(null);
    setVotes({ for: 0, against: 0, abstain: 0 });
    setResponseId(null);
    setResponseText("");
    setError(null);
  }

  function submitCreate() {
    if (!form.subject.trim()) {
      setError("Subject is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        event_id: eventId,
        motion_type: form.motion_type,
        raised_by_id: form.raised_by_id || null,
        directed_to_ministry: form.directed_to_ministry || null,
        subject: form.subject.trim(),
        details: form.details.trim() || null,
      };
      const res = await createMotion(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setMotions([res.data, ...motions]);
      setForm(EMPTY_FORM);
      setCreating(false);
      setFlash(`Raised: ${payload.subject}`);
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function submitAdmit() {
    if (!rulingId) return;
    startTransition(async () => {
      const res = await admitMotion(rulingId, speakerNote || undefined);
      if (!res.success) {
        setError(res.error);
        return;
      }
      const motion = motions.find((m) => m.id === rulingId);
      const goesToVote =
        motion?.motion_type === "no_confidence" ||
        motion?.motion_type === "impeach_speaker";
      setMotions(
        motions.map((m) =>
          m.id === rulingId
            ? {
                ...m,
                status: goesToVote ? "voting" : "discussing",
                speaker_ruling: "admitted",
                speaker_note: speakerNote || null,
                ruled_at: new Date().toISOString(),
              }
            : m
        )
      );
      resetUI();
      setFlash("Motion admitted");
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function submitReject() {
    if (!rulingId || !speakerNote.trim()) {
      setError("Rejection note is required");
      return;
    }
    startTransition(async () => {
      const res = await rejectMotion(rulingId, speakerNote.trim());
      if (!res.success) {
        setError(res.error);
        return;
      }
      setMotions(
        motions.map((m) =>
          m.id === rulingId
            ? {
                ...m,
                status: "rejected",
                speaker_ruling: "rejected",
                speaker_note: speakerNote.trim(),
                ruled_at: new Date().toISOString(),
                resolved_at: new Date().toISOString(),
              }
            : m
        )
      );
      resetUI();
      setFlash("Motion rejected");
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function submitVote() {
    if (!votingId) return;
    startTransition(async () => {
      const res = await recordMotionVote(votingId, votes);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setMotions(
        motions.map((m) =>
          m.id === votingId
            ? {
                ...m,
                votes_for: votes.for,
                votes_against: votes.against,
                votes_abstain: votes.abstain,
                outcome: res.data.outcome,
                status: "resolved",
                resolved_at: new Date().toISOString(),
              }
            : m
        )
      );
      resetUI();
      setFlash(`Vote recorded — Motion ${res.data.outcome.toUpperCase()}`);
      setTimeout(() => setFlash(null), 3000);
    });
  }

  // Organiser backup launcher for the DIGITAL House vote (delegates vote on
  // their phones). The live vote is then managed from the Control panel; on
  // reveal, revealResults resolves the motion automatically.
  function openDigitalVote(motionId: string) {
    setError(null);
    setOpeningVoteId(motionId);
    startTransition(async () => {
      const res = await organiserOpenMotionVote(eventId, motionId);
      setOpeningVoteId(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(
        "Digital vote opened — delegates can now vote on their phones. Manage it from the Control panel."
      );
      setTimeout(() => setFlash(null), 5000);
    });
  }

  function submitResponse() {
    if (!responseId || !responseText.trim()) {
      setError("Response is required");
      return;
    }
    startTransition(async () => {
      const res = await recordMinisterResponse(responseId, responseText.trim(), true);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setMotions(
        motions.map((m) =>
          m.id === responseId
            ? {
                ...m,
                minister_response: responseText.trim(),
                status: "resolved",
                resolved_at: new Date().toISOString(),
              }
            : m
        )
      );
      resetUI();
      setFlash("Minister response recorded");
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function handleDelete(m: Motion) {
    if (!confirm(`Delete motion: "${m.subject}"?`)) return;
    startTransition(async () => {
      const res = await deleteMotion(m.id, eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setMotions(motions.filter((x) => x.id !== m.id));
      setFlash("Motion deleted");
      setTimeout(() => setFlash(null), 2500);
    });
  }

  const counts = MOTION_TYPES.reduce(
    (acc, t) => {
      acc[t.code] = motions.filter((m) => m.motion_type === t.code).length;
      return acc;
    },
    {} as Record<MotionType, number>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
            <Gavel className="size-7 text-[#FF9933]" />
            Parliamentary Motions
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {eventName} · Handbook pages 23–24
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setForm(EMPTY_FORM);
            setError(null);
          }}
          className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
        >
          <Plus className="size-4 mr-2" /> Raise Motion
        </Button>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {/* Motion type filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
            filter === "all"
              ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
              : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
          }`}
        >
          All ({motions.length})
        </button>
        {MOTION_TYPES.map((t) => (
          <button
            key={t.code}
            onClick={() => setFilter(t.code)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filter === t.code
                ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
                : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
            }`}
          >
            {t.label} {counts[t.code] > 0 && `(${counts[t.code]})`}
          </button>
        ))}
      </div>

      {/* Create form */}
      {creating && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-lg">Raise a New Motion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Motion Type *</label>
                <select
                  value={form.motion_type}
                  onChange={(e) =>
                    setForm({ ...form, motion_type: e.target.value as MotionType })
                  }
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                >
                  {MOTION_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label} (Handbook p.{t.handbookPage})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#1a1a3e]/60 mt-1 italic">
                  {motionMeta(form.motion_type).description}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Raised By</label>
                <select
                  value={form.raised_by_id}
                  onChange={(e) => setForm({ ...form, raised_by_id: e.target.value })}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— Select participant —</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.parliament_role ? `· ${p.parliament_role}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {(form.motion_type === "calling_attention" ||
                form.motion_type === "laying_of_papers") && (
                <div>
                  <label className="text-xs font-medium text-[#1a1a3e]/70">
                    Directed to Ministry
                  </label>
                  <select
                    value={form.directed_to_ministry}
                    onChange={(e) =>
                      setForm({ ...form, directed_to_ministry: e.target.value })
                    }
                    className="w-full border border-input rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {MINISTRIES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Subject *</label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Water crisis affecting multiple neighborhoods"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Details / Context</label>
                <Textarea
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  rows={3}
                  placeholder="Supporting details the Speaker needs to rule on admission…"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={submitCreate}
                disabled={pending}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Raise Motion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ruling panel */}
      {rulingId && (
        <RulingPanel
          motion={motions.find((m) => m.id === rulingId)!}
          speakerNote={speakerNote}
          setSpeakerNote={setSpeakerNote}
          onAdmit={submitAdmit}
          onReject={submitReject}
          onCancel={resetUI}
          pending={pending}
          error={error}
        />
      )}

      {/* Vote panel */}
      {votingId && (
        <VotePanel
          motion={motions.find((m) => m.id === votingId)!}
          votes={votes}
          setVotes={setVotes}
          onSubmit={submitVote}
          onCancel={resetUI}
          pending={pending}
          error={error}
        />
      )}

      {/* Response panel */}
      {responseId && (
        <ResponsePanel
          motion={motions.find((m) => m.id === responseId)!}
          responseText={responseText}
          setResponseText={setResponseText}
          onSubmit={submitResponse}
          onCancel={resetUI}
          pending={pending}
          error={error}
        />
      )}

      {/* Motions table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-[#1a1a3e]/50 py-12">
                    No motions raised yet.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((m) => {
                const meta = motionMeta(m.motion_type);
                const statusCls = MOTION_STATUS_COLORS[m.status];
                const canRule = m.status === "submitted";
                const canVote = m.status === "voting";
                const canRespond =
                  m.status === "discussing" &&
                  (m.motion_type === "calling_attention" ||
                    m.motion_type === "breach_of_privilege" ||
                    m.motion_type === "laying_of_papers");

                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${meta.color}`} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{meta.label}</span>
                          <span className="text-[10px] text-[#1a1a3e]/50">p. {meta.handbookPage}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-[#1a1a3e]">{m.subject}</div>
                      {m.details && (
                        <div className="text-xs text-[#1a1a3e]/60 mt-0.5 line-clamp-2">
                          {m.details}
                        </div>
                      )}
                      {m.speaker_note && (
                        <div className="text-xs mt-1 italic text-amber-700">
                          Speaker: &ldquo;{m.speaker_note}&rdquo;
                        </div>
                      )}
                      {m.minister_response && (
                        <div className="text-xs mt-1 text-blue-700">
                          Minister: {m.minister_response}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.raised_by_name ?? "—"}
                      {m.raised_by_party_side && (
                        <Badge
                          variant="secondary"
                          className={`ml-1 text-[9px] ${
                            m.raised_by_party_side === "ruling"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {m.raised_by_party_side}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusCls} border text-[10px]`} variant="outline">
                        {MOTION_STATUS_LABELS[m.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.outcome && (
                        <Badge
                          className={`text-[10px] border ${
                            m.outcome === "passed"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }`}
                          variant="outline"
                        >
                          {m.outcome.toUpperCase()}
                          {m.votes_for + m.votes_against + m.votes_abstain > 0 &&
                            ` (${m.votes_for}–${m.votes_against}–${m.votes_abstain})`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {canRule && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              resetUI();
                              setRulingId(m.id);
                            }}
                          >
                            <Gavel className="size-3 mr-1" /> Rule
                          </Button>
                        )}
                        {canVote && isHouseVoteMotionType(m.motion_type) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => openDigitalVote(m.id)}
                            className="bg-emerald-50 border-emerald-200 text-emerald-700"
                          >
                            <Vote className="size-3 mr-1" />
                            {openingVoteId === m.id ? "Opening…" : "Open Digital Vote"}
                          </Button>
                        )}
                        {canVote && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              resetUI();
                              setVotingId(m.id);
                            }}
                            className="bg-violet-50 border-violet-200 text-violet-700"
                          >
                            <Vote className="size-3 mr-1" /> Manual Tally
                          </Button>
                        )}
                        {canRespond && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              resetUI();
                              setResponseId(m.id);
                            }}
                            className="bg-blue-50 border-blue-200 text-blue-700"
                          >
                            <MessageSquare className="size-3 mr-1" /> Respond
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(m)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RulingPanel({
  motion,
  speakerNote,
  setSpeakerNote,
  onAdmit,
  onReject,
  onCancel,
  pending,
  error,
}: {
  motion: Motion;
  speakerNote: string;
  setSpeakerNote: (s: string) => void;
  onAdmit: () => void;
  onReject: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <Card className="border-amber-300">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Gavel className="size-4 text-amber-600" />
          Speaker's Ruling: {motion.subject}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-[#1a1a3e]/70 italic">
          {motionMeta(motion.motion_type).description}
        </div>
        <div>
          <label className="text-xs font-medium text-[#1a1a3e]/70">
            Speaker's Note (required for rejection)
          </label>
          <Textarea
            value={speakerNote}
            onChange={(e) => setSpeakerNote(e.target.value)}
            rows={2}
            placeholder="Grounds for ruling…"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onReject}
            disabled={pending}
            variant="outline"
            className="text-red-700 border-red-200 hover:bg-red-50"
          >
            <X className="size-4 mr-2" /> Reject
          </Button>
          <Button
            onClick={onAdmit}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
            <Check className="size-4 mr-2" /> Admit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VotePanel({
  motion,
  votes,
  setVotes,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  motion: Motion;
  votes: { for: number; against: number; abstain: number };
  setVotes: (v: { for: number; against: number; abstain: number }) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <Card className="border-violet-300">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Vote className="size-4 text-violet-600" />
          Record Vote: {motion.subject}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-emerald-700">Ayes (For)</label>
            <Input
              type="number"
              min={0}
              value={votes.for}
              onChange={(e) => setVotes({ ...votes, for: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-red-700">Noes (Against)</label>
            <Input
              type="number"
              min={0}
              value={votes.against}
              onChange={(e) => setVotes({ ...votes, against: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Abstain</label>
            <Input
              type="number"
              min={0}
              value={votes.abstain}
              onChange={(e) => setVotes({ ...votes, abstain: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={pending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
            Record & Resolve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResponsePanel({
  motion,
  responseText,
  setResponseText,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  motion: Motion;
  responseText: string;
  setResponseText: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <Card className="border-blue-300">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="size-4 text-blue-600" />
          Minister's Response: {motion.subject}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          rows={4}
          placeholder="Minister's response to the House…"
        />
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={pending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
            Record & Resolve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
