"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertSessionParameters,
  deactivateSessionParameters,
  type SessionParametersConfig,
  type ParameterKind,
} from "@/app/yip/actions/session-parameters";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  X,
  Pencil,
} from "lucide-react";

// The scoreable session types (agenda_type) + friendly labels for the dropdown.
const SESSION_TYPES: { value: string; label: string }[] = [
  { value: "speaker_election", label: "Speaker Election / Candidates' Speeches" },
  { value: "cabinet_intro", label: "Cabinet & Party Leader Introductions" },
  { value: "opening_speech", label: "Opening Speeches / Urgent Public Importance" },
  { value: "debate", label: "Debate (Short Duration / Central Agenda)" },
  { value: "committee_discussion", label: "Committee Discussions (Bill Drafting)" },
  { value: "question_hour", label: "Question Hour" },
  { value: "zero_hour", label: "Zero Hour" },
  { value: "bill_presentation", label: "Bill Presentation & Voting" },
];

type RubricCriterion = { key: string; label: string; max_score: number };

type DraftParam = {
  key: string;
  label: string;
  kind: ParameterKind;
  max_score: string;
  weight: string;
};

const blankParam = (): DraftParam => ({
  key: "",
  label: "",
  kind: "evaluation",
  max_score: "10",
  weight: "1",
});

function toDraft(c: SessionParametersConfig): DraftParam[] {
  return c.parameters.map((p) => ({
    key: p.key,
    label: p.label,
    kind: p.kind,
    max_score: String(p.max_score),
    weight: String(p.weight),
  }));
}

export function SessionParametersClient({
  initialConfigs,
  rubricCriteria,
}: {
  initialConfigs: SessionParametersConfig[];
  rubricCriteria: RubricCriterion[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // agenda_type | "__new__" | null
  const [agendaType, setAgendaType] = useState("");
  const [label, setLabel] = useState("");
  const [sessionWeight, setSessionWeight] = useState("1");
  const [params, setParams] = useState<DraftParam[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byType = new Map(initialConfigs.map((c) => [c.agenda_type, c]));

  function startNew() {
    setErr(null);
    setEditing("__new__");
    setAgendaType("");
    setLabel("");
    setSessionWeight("1");
    setParams([blankParam()]);
  }

  function startEdit(c: SessionParametersConfig) {
    setErr(null);
    setEditing(c.agenda_type);
    setAgendaType(c.agenda_type);
    setLabel(c.label);
    setSessionWeight(String(c.session_weight));
    setParams(toDraft(c));
  }

  function cancel() {
    setEditing(null);
    setErr(null);
  }

  function seedFrom110() {
    setParams(
      rubricCriteria.map((c) => ({
        key: c.key,
        label: c.label,
        kind: "evaluation" as ParameterKind,
        max_score: String(c.max_score),
        weight: "1",
      }))
    );
  }

  function setParam(i: number, patch: Partial<DraftParam>) {
    setParams((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  const totalMax = params.reduce((s, p) => {
    const n = Number(p.max_score);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await upsertSessionParameters({
      agenda_type: agendaType,
      label,
      session_weight: Number(sessionWeight),
      parameters: params.map((p) => ({
        key: p.key.trim(),
        label: p.label.trim(),
        kind: p.kind,
        max_score: Number(p.max_score),
        weight: Number(p.weight),
      })),
    });
    setSaving(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(agenda_type: string) {
    const res = await deactivateSessionParameters(agenda_type);
    if (res.success) router.refresh();
  }

  const configuredTypes = new Set(initialConfigs.map((c) => c.agenda_type));
  const unconfigured = SESSION_TYPES.filter((t) => !configuredTypes.has(t.value));

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a3e]">Session Scoring</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#1a1a3e]/60">
            Define the scoring parameters and weight for each session type. This
            is <strong>global</strong> — it applies to every chapter and every
            event. A delegate&apos;s final score is the{" "}
            <strong>weighted average</strong> across the sessions they were
            scored in.
          </p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#FF9933] px-4 py-2 text-sm font-medium text-white hover:bg-[#E68A2E]"
          >
            <Plus className="size-4" /> Add session
          </button>
        )}
      </div>

      {/* Editor */}
      {editing !== null && (
        <div className="mt-6 rounded-xl border border-[#1a1a3e]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1a1a3e]">
              {editing === "__new__" ? "New session config" : `Editing: ${label}`}
            </h2>
            <button
              type="button"
              onClick={cancel}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-xs font-medium text-[#1a1a3e]/70">
              Session type
              <select
                value={agendaType}
                disabled={editing !== "__new__"}
                onChange={(e) => {
                  setAgendaType(e.target.value);
                  const t = SESSION_TYPES.find((s) => s.value === e.target.value);
                  if (t && !label) setLabel(t.label);
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select…</option>
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-[#1a1a3e]/70">
              Display label
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-[#1a1a3e]/70">
              Session weight (in final average)
              <input
                type="number"
                min={0}
                step="0.1"
                value={sessionWeight}
                onChange={(e) => setSessionWeight(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {/* Parameters */}
          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1a1a3e]">
              Parameters{" "}
              <span className="font-normal text-[#1a1a3e]/50">
                (total max {totalMax})
              </span>
            </h3>
            {rubricCriteria.length > 0 && (
              <button
                type="button"
                onClick={seedFrom110}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                <Sparkles className="size-3.5" /> Seed from handbook 110 rubric
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2">
            <div className="hidden grid-cols-[1fr_1fr_140px_90px_90px_40px] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-[#1a1a3e]/40 sm:grid">
              <span>Key</span>
              <span>Label</span>
              <span>Kind</span>
              <span>Max</span>
              <span>Weight</span>
              <span />
            </div>
            {params.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-2 sm:grid-cols-[1fr_1fr_140px_90px_90px_40px] sm:items-center sm:border-0 sm:p-0"
              >
                <input
                  placeholder="key_snake_case"
                  value={p.key}
                  onChange={(e) => setParam(i, { key: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  placeholder="Label"
                  value={p.label}
                  onChange={(e) => setParam(i, { label: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={p.kind}
                  onChange={(e) => setParam(i, { kind: e.target.value as ParameterKind })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="evaluation">Evaluation</option>
                  <option value="participation">Participation</option>
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Max"
                  value={p.max_score}
                  onChange={(e) => setParam(i, { max_score: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="Weight"
                  value={p.weight}
                  onChange={(e) => setParam(i, { weight: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setParams((prev) => prev.filter((_, idx) => idx !== i))}
                  className="flex items-center justify-center rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setParams((prev) => [...prev, blankParam()])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="size-3.5" /> Add parameter
          </button>

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF9933] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#E68A2E] disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Configured sessions */}
      <div className="mt-6 space-y-3">
        {initialConfigs.length === 0 && editing === null && (
          <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
            No session scoring configured yet. Click “Add session” to define the
            parameters and weight for each session type.
          </div>
        )}
        {initialConfigs.map((c) => (
          <div
            key={c.agenda_type}
            className="rounded-xl border border-[#1a1a3e]/10 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#1a1a3e]">{c.label}</p>
                <p className="text-xs text-[#1a1a3e]/50">
                  {c.agenda_type} · total max {c.total_max} · session weight{" "}
                  {c.session_weight}
                  {!c.is_active && " · inactive"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Edit"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.agenda_type)}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Deactivate"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.parameters.map((p) => (
                <span
                  key={p.key}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    p.kind === "participation"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.label} · {p.max_score} (w{p.weight})
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {unconfigured.length > 0 && editing === null && (
        <p className="mt-4 text-xs text-[#1a1a3e]/40">
          Not yet configured: {unconfigured.map((t) => t.label).join(" · ")}
        </p>
      )}
    </div>
  );
}
