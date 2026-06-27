"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import {
  FileText,
  MessageSquare,
  GitPullRequestArrow,
  Users,
  Loader2,
  Lock,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Send,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ArrowRight,
  ClipboardList,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";
import {
  getCommitteeRoom,
  saveBillField,
  saveClause,
  addClause,
  removeClause,
  saveObjective,
  addObjective,
  removeObjective,
  assignBillRole,
  proposeAmendment,
  voteAmendment,
  resolveAmendment,
  submitCommitteeBill,
  type CommitteeRoom,
  type RoomAmendment,
} from "@/app/yip/actions/committee-room";
import {
  listMessages,
  postChannelMessage,
  type ChatMessage,
} from "@/app/yip/actions/chat";
import {
  BillTemplateButton,
  CommitteeDocumentsSection,
} from "./committee-extras";

const ORANGE = "#FF9933";

type Tab = "bill" | "discussion" | "amendments" | "roles";

const PHASE_BADGE: Record<
  CommitteeRoom["phase"],
  { label: string; className: string }
> = {
  drafting: { label: "Drafting", className: "bg-amber-100 text-amber-700" },
  presentation: {
    label: "Presentation",
    className: "bg-purple-100 text-purple-700",
  },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  voted: { label: "Voted", className: "bg-emerald-100 text-emerald-700" },
  locked: { label: "Locked", className: "bg-gray-100 text-gray-600" },
};

export function CommitteeClient({
  eventId,
  participantId,
  participantName,
  committeeName: committeeNameProp,
  billFeedback,
}: {
  eventId: string;
  // Participant mode → participantId set (committee derived from session).
  // Organiser mode → participantId undefined + committeeName named explicitly.
  participantId?: string;
  participantName?: string;
  committeeName?: string;
  // The AI bill-feedback card, pre-rendered server-side (it's a server
  // component) and slotted into the Bill tab. Null in organiser mode.
  billFeedback?: React.ReactNode;
}) {
  const [room, setRoom] = useState<CommitteeRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("bill");

  const reload = useCallback(async () => {
    const r = await getCommitteeRoom(
      participantId
        ? { eventId, participantId }
        : { eventId, committeeName: committeeNameProp }
    );
    if (r.success) setRoom(r.data);
    else toast.error(r.error);
    return r;
  }, [eventId, participantId, committeeNameProp]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin mb-3" style={{ color: ORANGE }} />
        <p className="text-sm text-gray-500">Opening your committee room…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="py-8 text-center space-y-2">
          <XCircle className="mx-auto size-9 text-amber-400" />
          <p className="font-medium text-gray-800">
            You&apos;re not in a committee yet
          </p>
          <p className="text-sm text-gray-600">
            Committee work opens once the organisers allocate you to one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const phase = PHASE_BADGE[room.phase];
  const openAmendments = room.amendments.filter(
    (a) => a.status === "open"
  ).length;

  const tabs: { key: Tab; label: string; icon: typeof FileText; badge?: number }[] =
    [
      { key: "bill", label: "Bill", icon: FileText },
      { key: "discussion", label: "Discuss", icon: MessageSquare },
      {
        key: "amendments",
        label: "Amend",
        icon: GitPullRequestArrow,
        badge: openAmendments || undefined,
      },
      { key: "roles", label: "Roles", icon: Users },
    ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">
              {room.committeeName}
            </p>
            <p className="text-xs text-gray-500">Committee · bill workspace</p>
          </div>
          <Badge variant="secondary" className={phase.className}>
            {phase.label}
          </Badge>
        </div>
        {room.topic && (
          <div className="mt-2 rounded-lg bg-white/70 px-3 py-2">
            <p className="text-sm font-medium text-gray-800">{room.topic}</p>
            {room.scheme && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                Linked scheme / policy: {room.scheme}
              </p>
            )}
          </div>
        )}
        {room.permissions.needsChair && room.reportSubmitted && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-100/70 rounded-md px-2 py-1.5">
            No committee chair set yet — an organiser can assign one. Until then
            only organisers can edit the bill.
          </p>
        )}
      </div>

      {/* Presentation-day banner */}
      {room.presentationMode && (
        <div className="rounded-lg border border-purple-300 bg-purple-100/70 px-3 py-2 flex items-center gap-2">
          <Megaphone className="size-4 text-purple-600 shrink-0" />
          <p className="text-xs text-purple-800">
            Presentation time — the bill is locked. Get your presenters ready.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="sticky top-14 z-10 -mx-1 grid grid-cols-4 gap-1 rounded-xl bg-white/90 p-1 backdrop-blur border border-gray-100">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-[#FF9933]/10 text-[#FF9933]"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Icon className="size-4" />
              {tb.label}
              {tb.badge ? (
                <span className="absolute -top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {tb.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "bill" && (
        <BillTab
          eventId={eventId}
          participantId={participantId}
          room={room}
          reload={reload}
          billFeedback={billFeedback}
        />
      )}
      {tab === "discussion" && (
        <DiscussionTab
          room={room}
          participantId={participantId}
          participantName={participantName}
        />
      )}
      {tab === "amendments" && (
        <AmendmentsTab
          eventId={eventId}
          participantId={participantId}
          room={room}
          reload={reload}
        />
      )}
      {tab === "roles" && (
        <RolesTab eventId={eventId} participantId={participantId} room={room} reload={reload} />
      )}
    </div>
  );
}

// ─── Bill tab ────────────────────────────────────────────────────────────

function BillTab({
  eventId,
  participantId,
  room,
  reload,
  billFeedback,
}: {
  eventId: string;
  participantId?: string;
  room: CommitteeRoom;
  reload: () => Promise<unknown>;
  billFeedback?: React.ReactNode;
}) {
  const p = room.permissions;
  const canEdit = p.canEditBill;
  const bill = room.bill;
  const [isPending, startTransition] = useTransition();
  const [threadClauseId, setThreadClauseId] = useState<string | null>(null);
  const [newClause, setNewClause] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Local editable mirrors of the official-template scalar sections (save on
  // blur). Keys match the server BILL_FIELDS names.
  const buildFields = () => ({
    title: bill?.title ?? "",
    preamble: bill?.preamble ?? "",
    definitions: bill?.definitions ?? "",
    implementation: bill?.implementation ?? "",
    funding_budget: bill?.fundingBudget ?? "",
    expected_impact: bill?.expectedImpact ?? "",
    conclusion: bill?.conclusion ?? "",
  });
  const [fields, setFields] = useState(buildFields);
  useEffect(() => {
    setFields(buildFields());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id, bill?.status]);

  // Per-clause local text (save on blur).
  const [clauseText, setClauseText] = useState<Record<string, string>>({});
  useEffect(() => {
    const m: Record<string, string> = {};
    for (const c of bill?.clauses ?? []) m[c.id] = c.text;
    setClauseText(m);
  }, [bill?.id, JSON.stringify(bill?.clauses ?? [])]);

  // Per-objective local text (save on blur) + add box.
  const [objectiveText, setObjectiveText] = useState<Record<string, string>>({});
  const [newObjective, setNewObjective] = useState("");
  useEffect(() => {
    const m: Record<string, string> = {};
    for (const o of bill?.objectives ?? []) m[o.id] = o.text;
    setObjectiveText(m);
  }, [bill?.id, JSON.stringify(bill?.objectives ?? [])]);

  async function persistObjective(objectiveId: string, value: string) {
    if (!canEdit) return;
    const original =
      bill?.objectives.find((o) => o.id === objectiveId)?.text ?? "";
    if (value.trim() === original) return;
    const r = await saveObjective({
      eventId,
      committeeName: room.committeeName,
      participantId,
      objectiveId,
      text: value,
    });
    if (!r.success) toast.error(r.error);
    else await reload();
  }

  function handleAddObjective() {
    const text = newObjective.trim();
    if (!text) return;
    startTransition(async () => {
      const r = await addObjective({
        eventId,
        committeeName: room.committeeName,
        participantId,
        text,
      });
      if (!r.success) toast.error(r.error);
      else {
        setNewObjective("");
        await reload();
      }
    });
  }

  function handleRemoveObjective(objectiveId: string) {
    startTransition(async () => {
      const r = await removeObjective({
        eventId,
        committeeName: room.committeeName,
        participantId,
        objectiveId,
      });
      if (!r.success) toast.error(r.error);
      else await reload();
    });
  }

  async function persistField(field: keyof typeof fields, value: string) {
    if (!canEdit) return;
    const originals: Record<string, string> = buildFields();
    if (value === (originals[field] ?? "")) return;
    const r = await saveBillField({
      eventId,
      committeeName: room.committeeName,
      participantId,
      field,
      value,
    });
    if (!r.success) {
      toast.error(r.error);
    } else {
      await reload();
    }
  }

  async function persistClause(clauseId: string, value: string) {
    if (!canEdit) return;
    const original = bill?.clauses.find((c) => c.id === clauseId)?.text ?? "";
    if (value.trim() === original) return;
    const r = await saveClause({
      eventId,
      committeeName: room.committeeName,
      participantId,
      clauseId,
      text: value,
    });
    if (!r.success) toast.error(r.error);
    else await reload();
  }

  function handleAddClause() {
    const text = newClause.trim();
    if (!text) return;
    startTransition(async () => {
      const r = await addClause({
        eventId,
        committeeName: room.committeeName,
        participantId,
        text,
      });
      if (!r.success) toast.error(r.error);
      else {
        setNewClause("");
        await reload();
      }
    });
  }

  function handleRemoveClause(clauseId: string) {
    startTransition(async () => {
      const r = await removeClause({
        eventId,
        committeeName: room.committeeName,
        participantId,
        clauseId,
      });
      if (!r.success) toast.error(r.error);
      else await reload();
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const r = await submitCommitteeBill({
        eventId,
        committeeName: room.committeeName,
        participantId,
      });
      if (!r.success) toast.error(r.error);
      else {
        toast.success("Bill submitted to the House.");
        setConfirmSubmit(false);
        await reload();
      }
    });
  }

  // Locked until the Committee Report is in. The template + documents stay
  // available even while locked (as on the old bill page).
  if (!room.reportSubmitted) {
    return (
      <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-6 text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100">
            <Lock className="size-6 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              Submit your Committee Report first
            </p>
            <p className="text-sm text-gray-600 mt-1">
              The bill is built from your report&apos;s findings. Once the report
              is submitted, drafting unlocks here.
            </p>
          </div>
          <Link href="/yip/me/report">
            <Button style={{ backgroundColor: ORANGE }} className="text-white">
              <ClipboardList className="size-4 mr-1.5" />
              Go to Committee Report
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
      <BillTemplateButton
        committeeName={room.committeeName}
        topic={room.topic}
        scheme={room.scheme}
      />
      {participantId && (
        <CommitteeDocumentsSection eventId={eventId} participantId={participantId} />
      )}
      </div>
    );
  }

  const r = room.readiness;
  const readOnly = !canEdit;

  return (
    <div className="space-y-4">
      {/* Readiness / submit */}
      {bill?.status === "drafting" || !bill ? (
        <Card>
          <CardContent className="py-3.5 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ready to submit?
            </p>
            <ul className="space-y-1.5">
              <Check ok={r.hasTitle} label="Bill has a title" />
              <Check ok={r.hasPreamble} label="Preamble written" />
              <Check
                ok={r.objectiveCount >= r.minObjectives}
                label={`At least ${r.minObjectives} objectives (${r.objectiveCount}/${r.minObjectives})`}
              />
              <Check
                ok={r.provisionCount >= r.minProvisions}
                label={`At least ${r.minProvisions} provisions (${r.provisionCount}/${r.minProvisions})`}
              />
              <Check ok={r.hasPresenters} label="Presenter chosen (Roles tab)" />
            </ul>
            {p.canSubmit && (
              <Button
                disabled={!r.ready || isPending}
                onClick={() => setConfirmSubmit(true)}
                style={{ backgroundColor: ORANGE }}
                className="w-full text-white disabled:opacity-50"
              >
                <Send className="size-4 mr-1.5" />
                Submit bill to the House
              </Button>
            )}
            {!p.canSubmit && !readOnly && (
              <p className="text-[11px] text-gray-400">
                The chair or lead drafter submits the bill.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          Bill {bill.status}. {bill.status === "submitted" && "Awaiting the House."}
        </div>
      )}

      {readOnly && (
        <p className="text-[11px] text-gray-400 px-1">
          {p.isMember
            ? "Your chair / lead drafter edits the bill. You can still discuss it and propose amendments."
            : "Viewing as organiser."}
        </p>
      )}

      <Card>
        <CardContent className="py-4 space-y-4">
          {/* 1. Title */}
          <Field label="Title of the Bill" required>
            <Input
              value={fields.title}
              disabled={readOnly}
              onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
              onBlur={(e) => persistField("title", e.target.value)}
              placeholder="e.g., The Youth Digital Literacy Bill, 2026"
            />
          </Field>

          {/* 2. Preamble */}
          <Field label="Preamble" required>
            <Textarea
              value={fields.preamble}
              disabled={readOnly}
              rows={3}
              onChange={(e) =>
                setFields((f) => ({ ...f, preamble: e.target.value }))
              }
              onBlur={(e) => persistField("preamble", e.target.value)}
              placeholder="The rationale behind the bill — the issue it addresses and its significance."
            />
          </Field>

          {/* 3. Definitions */}
          <Field label="Definitions">
            <Textarea
              value={fields.definitions}
              disabled={readOnly}
              rows={2}
              onChange={(e) =>
                setFields((f) => ({ ...f, definitions: e.target.value }))
              }
              onBlur={(e) => persistField("definitions", e.target.value)}
              placeholder="Define any technical terms used in the bill, to avoid misinterpretation."
            />
          </Field>

          {/* 4. Objectives (2-4 list) */}
          <div>
            <p className="text-sm font-medium text-gray-700">
              Objectives of the Bill <span className="text-[#FF9933]">*</span>
            </p>
            <p className="text-[11px] text-gray-400 mb-2">
              2 to 4 key objectives — specific, measurable, aligned with the purpose.
            </p>
            <div className="space-y-2">
              {(bill?.objectives ?? []).map((o, i) => (
                <div key={o.id} className="flex items-start gap-2">
                  <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#138808]/15 text-[10px] font-bold text-[#138808]">
                    {i + 1}
                  </span>
                  <Textarea
                    value={objectiveText[o.id] ?? o.text}
                    disabled={readOnly}
                    rows={1}
                    onChange={(e) =>
                      setObjectiveText((m) => ({ ...m, [o.id]: e.target.value }))
                    }
                    onBlur={(e) => persistObjective(o.id, e.target.value)}
                    className="flex-1 bg-white"
                  />
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveObjective(o.id)}
                      disabled={isPending}
                      className="mt-1 rounded p-1.5 text-red-500 hover:bg-red-50"
                      title="Remove objective"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {(bill?.objectives ?? []).length === 0 && (
                <p className="text-sm text-gray-400 py-1">
                  No objectives yet{canEdit ? " — add 2–4 below." : "."}
                </p>
              )}
            </div>
            {canEdit && (bill?.objectives?.length ?? 0) < 4 && (
              <div className="mt-2 flex items-start gap-2">
                <Textarea
                  value={newObjective}
                  rows={1}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Add an objective…"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddObjective}
                  disabled={isPending || !newObjective.trim()}
                  variant="outline"
                  className="shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* 5. Key Provisions / clauses */}
          <div>
            <p className="text-sm font-medium text-gray-700">
              Key Provisions (Sections)
            </p>
            <p className="text-[11px] text-gray-400 mb-2">
              The clauses of the bill. Each can be discussed and amended.
            </p>
            <div className="space-y-2">
              {(bill?.clauses ?? []).map((c, i) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-gray-200 bg-gray-50/60 p-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#FF9933]/15 text-[10px] font-bold text-[#FF9933]">
                      {i + 1}
                    </span>
                    <Textarea
                      value={clauseText[c.id] ?? c.text}
                      disabled={readOnly}
                      rows={2}
                      onChange={(e) =>
                        setClauseText((m) => ({ ...m, [c.id]: e.target.value }))
                      }
                      onBlur={(e) => persistClause(c.id, e.target.value)}
                      className="flex-1 bg-white"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-end gap-1">
                    {participantId && (
                      <button
                        onClick={() => setThreadClauseId(c.id)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
                      >
                        <MessageSquare className="size-3" /> Discuss
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveClause(c.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="size-3" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(bill?.clauses ?? []).length === 0 && (
                <p className="text-sm text-gray-400 py-1">
                  No provisions yet
                  {canEdit ? " — add the first below." : "."}
                </p>
              )}
            </div>

            {canEdit && (
              <div className="mt-2 flex items-start gap-2">
                <Textarea
                  value={newClause}
                  rows={2}
                  onChange={(e) => setNewClause(e.target.value)}
                  placeholder="Add a provision…"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddClause}
                  disabled={isPending || !newClause.trim()}
                  variant="outline"
                  className="shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* 6. Implementation Plan */}
          <Field label="Implementation Plan">
            <Textarea
              value={fields.implementation}
              disabled={readOnly}
              rows={2}
              onChange={(e) =>
                setFields((f) => ({ ...f, implementation: e.target.value }))
              }
              onBlur={(e) => persistField("implementation", e.target.value)}
              placeholder="Responsible bodies, key timelines, and processes for rollout."
            />
          </Field>

          {/* 7. Funding / Budget */}
          <Field label="Funding / Budget (if relevant)">
            <Textarea
              value={fields.funding_budget}
              disabled={readOnly}
              rows={2}
              onChange={(e) =>
                setFields((f) => ({ ...f, funding_budget: e.target.value }))
              }
              onBlur={(e) => persistField("funding_budget", e.target.value)}
              placeholder="Estimated funding required and sources (govt allocation, sponsorship, PPP…)."
            />
          </Field>

          {/* 8. Expected Impact */}
          <Field label="Expected Impact">
            <Textarea
              value={fields.expected_impact}
              disabled={readOnly}
              rows={2}
              onChange={(e) =>
                setFields((f) => ({ ...f, expected_impact: e.target.value }))
              }
              onBlur={(e) => persistField("expected_impact", e.target.value)}
              placeholder="Intended benefits, improvements, and measurable changes."
            />
          </Field>

          {/* 9. Conclusion / Call to Action */}
          <Field label="Conclusion / Call to Action">
            <Textarea
              value={fields.conclusion}
              disabled={readOnly}
              rows={2}
              onChange={(e) =>
                setFields((f) => ({ ...f, conclusion: e.target.value }))
              }
              onBlur={(e) => persistField("conclusion", e.target.value)}
              placeholder="A compelling summary that reinforces the bill's urgency and importance."
            />
          </Field>
        </CardContent>
      </Card>

      {room.presentationMode && bill?.oppositionResponse && (
        <Card className="border-purple-200">
          <CardContent className="py-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
              Opposition response
            </p>
            <p className="text-sm text-gray-700 mt-1">{bill.oppositionResponse}</p>
          </CardContent>
        </Card>
      )}

      {/* Carried over from the old bill page: template · AI feedback · docs. */}
      <BillTemplateButton
        committeeName={room.committeeName}
        topic={room.topic}
        scheme={room.scheme}
      />
      {billFeedback}
      {participantId && (
        <CommitteeDocumentsSection eventId={eventId} participantId={participantId} />
      )}

      {/* Per-clause discussion dialog (participant mode only — organisers
          moderate from the Chat page). */}
      {threadClauseId && room.chatChannelId && participantId && (
        <ClauseThreadDialog
          open
          onClose={() => setThreadClauseId(null)}
          channelId={room.chatChannelId}
          threadKey={`clause:${threadClauseId}`}
          title={`Clause ${
            (bill?.clauses.findIndex((c) => c.id === threadClauseId) ?? -1) + 1
          } discussion`}
          participantId={participantId}
          canPost={room.permissions.canDiscuss}
          members={room.members}
        />
      )}
      {threadClauseId && !room.chatChannelId && (
        <Dialog open onOpenChange={() => setThreadClauseId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Discussion not open yet</DialogTitle>
              <DialogDescription>
                Per-clause discussion opens once the organisers turn on chat for
                this event.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}

      {/* Submit confirm */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit the bill?</DialogTitle>
            <DialogDescription>
              Once submitted, the committee can no longer edit it. It goes to the
              House for presentation and voting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleSubmit}
              style={{ backgroundColor: ORANGE }}
              className="text-white"
            >
              {isPending ? "Submitting…" : "Yes, submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Amendments tab ──────────────────────────────────────────────────────

function AmendmentsTab({
  eventId,
  participantId,
  room,
  reload,
}: {
  eventId: string;
  participantId?: string;
  room: CommitteeRoom;
  reload: () => Promise<unknown>;
}) {
  const p = room.permissions;
  const bill = room.bill;
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"edit" | "add" | "remove">("edit");
  const [clauseId, setClauseId] = useState<string>("");
  const [text, setText] = useState("");
  const [resolving, setResolving] = useState<RoomAmendment | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  function handlePropose() {
    if (!bill) {
      toast.error("Start the bill draft first.");
      return;
    }
    if (!participantId) return; // organisers don't propose; members do
    startTransition(async () => {
      const r = await proposeAmendment({
        eventId,
        committeeName: room.committeeName,
        participantId,
        kind,
        clauseId: kind === "add" ? null : clauseId || null,
        proposedText: kind === "remove" ? null : text,
      });
      if (!r.success) toast.error(r.error);
      else {
        toast.success("Amendment proposed.");
        setText("");
        setClauseId("");
        await reload();
      }
    });
  }

  function handleVote(am: RoomAmendment, vote: "for" | "against") {
    if (!participantId) return; // organisers don't vote
    startTransition(async () => {
      const r = await voteAmendment({
        eventId,
        committeeName: room.committeeName,
        participantId,
        amendmentId: am.id,
        vote,
      });
      if (!r.success) toast.error(r.error);
      else await reload();
    });
  }

  function handleResolve(decision: "accept" | "reject") {
    if (!resolving) return;
    startTransition(async () => {
      const r = await resolveAmendment({
        eventId,
        committeeName: room.committeeName,
        participantId,
        amendmentId: resolving.id,
        decision,
        note: resolveNote,
      });
      if (!r.success) toast.error(r.error);
      else {
        toast.success(decision === "accept" ? "Amendment folded in." : "Amendment rejected.");
        setResolving(null);
        setResolveNote("");
        await reload();
      }
    });
  }

  const open = room.amendments.filter((a) => a.status === "open");
  const resolved = room.amendments.filter((a) => a.status !== "open");

  return (
    <div className="space-y-4">
      {/* Propose */}
      {p.canPropose && bill && (
        <Card>
          <CardContent className="py-3.5 space-y-2.5">
            <p className="text-sm font-semibold text-gray-700">
              Propose an amendment
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["edit", "add", "remove"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-md border py-1.5 text-xs font-medium capitalize ${
                    kind === k
                      ? "border-[#FF9933] bg-[#FF9933]/10 text-[#FF9933]"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  {k === "edit" ? "Edit clause" : k === "add" ? "Add clause" : "Remove"}
                </button>
              ))}
            </div>
            {kind !== "add" && (
              <select
                value={clauseId}
                onChange={(e) => setClauseId(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
              >
                <option value="">— Pick a clause —</option>
                {bill.clauses.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {i + 1}. {c.text.slice(0, 50)}
                    {c.text.length > 50 ? "…" : ""}
                  </option>
                ))}
              </select>
            )}
            {kind !== "remove" && (
              <Textarea
                value={text}
                rows={2}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  kind === "add" ? "New clause text…" : "Replacement text…"
                }
              />
            )}
            <Button
              onClick={handlePropose}
              disabled={isPending}
              style={{ backgroundColor: ORANGE }}
              className="w-full text-white"
            >
              <GitPullRequestArrow className="size-4 mr-1.5" />
              Propose
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Open amendments */}
      {open.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">
          No open amendments.
        </p>
      ) : (
        open.map((am) => (
          <AmendmentCard
            key={am.id}
            am={am}
            canVote={p.canVote}
            canResolve={p.canResolve}
            disabled={isPending}
            onVote={handleVote}
            onResolve={(a) => {
              setResolving(a);
              setResolveNote("");
            }}
          />
        ))
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Resolved
          </p>
          {resolved.map((am) => (
            <AmendmentCard key={am.id} am={am} canVote={false} canResolve={false} disabled />
          ))}
        </div>
      )}

      {/* Resolve dialog */}
      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide on this amendment</DialogTitle>
            <DialogDescription>
              {resolving && (
                <span className="text-sm">
                  {amendmentSummary(resolving)} — the vote is{" "}
                  {resolving.votesFor} for / {resolving.votesAgainst} against
                  (advisory; your call decides).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={resolveNote}
            rows={2}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="Optional note (why)…"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => handleResolve("reject")}
              className="text-red-600"
            >
              <XCircle className="size-4 mr-1" /> Reject
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleResolve("accept")}
              style={{ backgroundColor: ORANGE }}
              className="text-white"
            >
              <CheckCircle2 className="size-4 mr-1" /> Accept &amp; fold in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function amendmentSummary(am: RoomAmendment): string {
  if (am.kind === "add") return "Add a new clause";
  if (am.kind === "remove") return "Remove this clause";
  return "Edit this clause";
}

function AmendmentCard({
  am,
  canVote,
  canResolve,
  disabled,
  onVote,
  onResolve,
}: {
  am: RoomAmendment;
  canVote: boolean;
  canResolve: boolean;
  disabled: boolean;
  onVote?: (am: RoomAmendment, v: "for" | "against") => void;
  onResolve?: (am: RoomAmendment) => void;
}) {
  const statusBadge: Record<RoomAmendment["status"], string> = {
    open: "bg-amber-100 text-amber-700",
    accepted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-600",
    withdrawn: "bg-gray-100 text-gray-500",
  };
  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-700">
            {amendmentSummary(am)}
          </span>
          <Badge variant="secondary" className={statusBadge[am.status]}>
            {am.status}
          </Badge>
        </div>
        {am.clauseText && (
          <p className="text-[11px] text-gray-400 italic line-clamp-2">
            On: “{am.clauseText}”
          </p>
        )}
        {am.proposedText && (
          <p className="text-sm text-gray-800 bg-gray-50 rounded-md px-2 py-1.5">
            {am.proposedText}
          </p>
        )}
        <p className="text-[11px] text-gray-400">by {am.proposedByName}</p>

        {am.status === "open" && (
          <div className="flex items-center gap-2 pt-1">
            {canVote && onVote && (
              <>
                <button
                  onClick={() => onVote(am, "for")}
                  disabled={disabled}
                  className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${
                    am.myVote === "for"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  <ThumbsUp className="size-3" /> {am.votesFor}
                </button>
                <button
                  onClick={() => onVote(am, "against")}
                  disabled={disabled}
                  className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${
                    am.myVote === "against"
                      ? "border-red-400 bg-red-50 text-red-600"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  <ThumbsDown className="size-3" /> {am.votesAgainst}
                </button>
              </>
            )}
            {!canVote && (
              <span className="text-[11px] text-gray-400">
                {am.votesFor} for · {am.votesAgainst} against
              </span>
            )}
            {canResolve && onResolve && (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onResolve(am)}
                className="ml-auto h-7 text-xs"
              >
                Decide
              </Button>
            )}
          </div>
        )}
        {am.status !== "open" && am.resolutionNote && (
          <p className="text-[11px] text-gray-500">Note: {am.resolutionNote}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Roles tab ───────────────────────────────────────────────────────────

const ROLE_DEFS: { key: "lead_drafter" | "presenter_1" | "presenter_2" | "policy_researcher"; label: string }[] = [
  { key: "lead_drafter", label: "Lead Drafter" },
  { key: "presenter_1", label: "Presenter 1" },
  { key: "presenter_2", label: "Presenter 2" },
  { key: "policy_researcher", label: "Policy Researcher" },
];

function RolesTab({
  eventId,
  participantId,
  room,
  reload,
}: {
  eventId: string;
  participantId?: string;
  room: CommitteeRoom;
  reload: () => Promise<unknown>;
}) {
  const bill = room.bill;
  const canAssign = room.permissions.canAssignRoles;
  const [saving, setSaving] = useState<string | null>(null);

  const current: Record<string, string | null> = {
    lead_drafter: bill?.leadDrafter ?? null,
    presenter_1: bill?.presenter1 ?? null,
    presenter_2: bill?.presenter2 ?? null,
    policy_researcher: bill?.policyResearcher ?? null,
  };

  async function assign(role: ROLEKEY, assigneeId: string | null) {
    setSaving(role);
    const r = await assignBillRole({
      eventId,
      committeeName: room.committeeName,
      participantId,
      role,
      assigneeId,
    });
    setSaving(null);
    if (!r.success) toast.error(r.error);
    else await reload();
  }

  const nameOf = (id: string | null) =>
    id ? room.members.find((m) => m.id === id)?.name ?? "—" : "—";

  if (!bill) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Start the bill draft first, then assign who leads, presents and
          researches it.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <Users className="size-4 text-purple-500" />
          <p className="text-sm font-semibold text-gray-700">
            Committee roles
          </p>
        </div>
        {ROLE_DEFS.map((rd) => (
          <div key={rd.key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-medium text-gray-500">
              {rd.label}
            </span>
            {canAssign ? (
              <select
                value={current[rd.key] ?? ""}
                disabled={saving === rd.key}
                onChange={(e) => assign(rd.key, e.target.value || null)}
                className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-2 text-sm disabled:opacity-50"
              >
                <option value="">— Unassigned —</option>
                {room.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.isChair ? " (Chair)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium text-gray-800">
                {nameOf(current[rd.key])}
              </span>
            )}
          </div>
        ))}
        {!canAssign && (
          <p className="text-[11px] text-gray-400 pt-1">
            The chair assigns roles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
type ROLEKEY = "lead_drafter" | "presenter_1" | "presenter_2" | "policy_researcher";

// ─── Discussion tab + clause thread ──────────────────────────────────────

function DiscussionTab({
  room,
  participantId,
  participantName,
}: {
  room: CommitteeRoom;
  participantId?: string;
  participantName?: string;
}) {
  // Organisers moderate the committee channel from the event Chat page (with the
  // full freeze / mute / report / delete toolkit) — the Room links them there
  // rather than re-implementing the moderator chat view.
  if (!participantId) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <MessageSquare className="mx-auto size-8 text-gray-300" />
          <p className="text-sm text-gray-600">
            Committee discussion is moderated from the event&apos;s Chat page.
          </p>
          <Link href={`/yip/dashboard/events/${room.eventId}/chat`}>
            <Button variant="outline">
              Open Chat moderation
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  if (!CHAT_ENABLED || !room.chatChannelId) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <MessageSquare className="mx-auto size-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            Committee discussion opens once the organisers enable chat for this
            event.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <ThreadView
      channelId={room.chatChannelId}
      threadKey={null}
      participantId={participantId}
      participantName={participantName ?? ""}
      canPost={room.permissions.canDiscuss}
      members={room.members}
      emptyHint="No messages yet — start the conversation."
    />
  );
}

function ClauseThreadDialog({
  open,
  onClose,
  channelId,
  threadKey,
  title,
  participantId,
  canPost,
  members,
}: {
  open: boolean;
  onClose: () => void;
  channelId: string;
  threadKey: string;
  title: string;
  participantId: string;
  canPost: boolean;
  members: CommitteeRoom["members"];
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <ThreadView
          channelId={channelId}
          threadKey={threadKey}
          participantId={participantId}
          participantName=""
          canPost={canPost}
          members={members}
          emptyHint="No notes on this clause yet."
          compact
        />
      </DialogContent>
    </Dialog>
  );
}

function ThreadView({
  channelId,
  threadKey,
  participantId,
  canPost,
  members,
  emptyHint,
  compact,
}: {
  channelId: string;
  threadKey: string | null;
  participantId: string;
  participantName?: string;
  canPost: boolean;
  members: CommitteeRoom["members"];
  emptyHint: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const nameOf = useCallback(
    (m: ChatMessage) => {
      if (m.senderParticipantId === participantId) return "You";
      if (m.senderKind === "yuva") return "Mentor";
      if (m.senderKind === "admin") return "Organiser";
      return (
        members.find((mm) => mm.id === m.senderParticipantId)?.name ?? "Member"
      );
    },
    [members, participantId]
  );

  const load = useCallback(async () => {
    const r = await listMessages({ channelId, participantId, threadKey });
    if (r.success) setMessages(r.data);
    setLoading(false);
  }, [channelId, participantId, threadKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const r = await postChannelMessage({
      participantId,
      channelId,
      body: text,
      threadKey,
    });
    setSending(false);
    if (!r.success) toast.error(r.error);
    else {
      setBody("");
      await load();
    }
  }

  return (
    <div className="flex flex-col">
      <div
        className={`space-y-2 overflow-y-auto ${
          compact ? "max-h-64" : "max-h-[60vh]"
        }`}
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-gray-300" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{emptyHint}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderParticipantId === participantId;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] text-gray-400 px-1">
                  {nameOf(m)}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine
                      ? "bg-[#FF9933] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {canPost ? (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={body}
            rows={1}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message your committee…"
            className="flex-1 resize-none"
          />
          <Button
            onClick={send}
            disabled={sending || !body.trim()}
            style={{ backgroundColor: ORANGE }}
            className="shrink-0 text-white"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-gray-400 text-center">
          Read-only — you&apos;re not posting in this committee.
        </p>
      )}
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-[#FF9933]"> *</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
      ) : (
        <Clock className="size-4 text-gray-300 shrink-0" />
      )}
      <span className={ok ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </li>
  );
}
