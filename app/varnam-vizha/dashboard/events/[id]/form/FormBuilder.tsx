"use client";

/**
 * Organiser form builder for per-event registration questions. Deliberately
 * validation-free: the saveRegistrationForm server action is the single source
 * of validation — this UI only disables Save while the request is pending and
 * shows the action's message inline.
 */
import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from "lucide-react";
import {
  saveRegistrationForm,
  type SaveFormState,
} from "@/lib/varnam/actions/manage-form";
import { MAX_FORM_FIELDS, type VarnamFormField } from "@/lib/varnam/forms/types";

const INITIAL: SaveFormState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

const TYPE_LABEL: Record<VarnamFormField["type"], string> = {
  text: "Short answer",
  phone: "Phone",
  textarea: "Long answer",
  select: "Dropdown",
  checkbox: "Checkbox",
};

const ADD_TYPES: VarnamFormField["type"][] = [
  "text",
  "phone",
  "textarea",
  "select",
  "checkbox",
];

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function FormBuilder({
  eventId,
  initialFields,
}: {
  eventId: string;
  initialFields: VarnamFormField[];
}) {
  const [fields, setFields] = useState<VarnamFormField[]>(initialFields);
  // Raw dropdown-options text per field id (preserves blank lines while typing).
  const [optionsDraft, setOptionsDraft] = useState<Record<string, string>>(
    () => {
      const m: Record<string, string> = {};
      for (const f of initialFields) {
        if (f.type === "select") m[f.id] = (f.options ?? []).join("\n");
      }
      return m;
    }
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    JSON.stringify(initialFields)
  );

  const [state, formAction, pending] = useActionState(
    async (_prev: SaveFormState): Promise<SaveFormState> => {
      const result = await saveRegistrationForm(eventId, fields);
      if (result.ok) setSavedSnapshot(JSON.stringify(fields));
      return result;
    },
    INITIAL
  );

  const dirty = JSON.stringify(fields) !== savedSnapshot;

  const patchField = (id: string, patch: Partial<VarnamFormField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addField = (type: VarnamFormField["type"]) =>
    setFields((prev) => {
      if (prev.length >= MAX_FORM_FIELDS) return prev;
      const field: VarnamFormField = { id: genId(), type, label: "", required: false };
      if (type === "select") field.options = [];
      return [...prev, field];
    });

  const removeField = (id: string) =>
    setFields((prev) => prev.filter((f) => f.id !== id));

  const moveField = (index: number, dir: -1 | 1) =>
    setFields((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const onOptionsChange = (id: string, text: string) => {
    setOptionsDraft((prev) => ({ ...prev, [id]: text }));
    patchField(id, {
      options: text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
  };

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#3B0A45]/20 bg-white p-8 text-center text-sm text-[#2B0A33]/50">
          No extra questions yet — add one below.
        </div>
      ) : (
        <ol className="space-y-3">
          {fields.map((f, i) => (
            <li
              key={f.id}
              className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex rounded-full bg-[#0CA4A5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#0a8485]">
                  {TYPE_LABEL[f.type]}
                </span>
                <span className="text-xs text-[#2B0A33]/40">Question {i + 1}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded-lg p-1.5 text-[#3B0A45]/60 transition hover:bg-[#3B0A45]/5 disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(i, 1)}
                    disabled={i === fields.length - 1}
                    aria-label="Move down"
                    className="rounded-lg p-1.5 text-[#3B0A45]/60 transition hover:bg-[#3B0A45]/5 disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(f.id)}
                    aria-label="Remove question"
                    className="rounded-lg p-1.5 text-[#D6336C]/70 transition hover:bg-[#D6336C]/10 hover:text-[#D6336C]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  value={f.label}
                  onChange={(e) => patchField(f.id, { label: e.target.value })}
                  placeholder={
                    f.type === "checkbox"
                      ? "Checkbox text (e.g. I need parking)"
                      : "Question label (e.g. T-shirt size)"
                  }
                  maxLength={120}
                  className={inputCls}
                />

                {f.type !== "checkbox" && (
                  <input
                    value={f.placeholder ?? ""}
                    onChange={(e) =>
                      patchField(f.id, { placeholder: e.target.value })
                    }
                    placeholder={
                      f.type === "select"
                        ? "Placeholder shown before an option is picked (optional)"
                        : "Placeholder text (optional)"
                    }
                    maxLength={120}
                    className={inputCls}
                  />
                )}

                {f.type === "select" && (
                  <div>
                    <textarea
                      value={optionsDraft[f.id] ?? ""}
                      onChange={(e) => onOptionsChange(f.id, e.target.value)}
                      placeholder={"One option per line, e.g.\nS\nM\nL\nXL"}
                      rows={4}
                      className={inputCls}
                    />
                    <p className="mt-1 text-xs text-[#2B0A33]/45">
                      One option per line (up to 20).
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-[#2B0A33]/80">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) =>
                      patchField(f.id, { required: e.target.checked })
                    }
                    className="size-4 accent-[#D6336C]"
                  />
                  Required
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#2B0A33]/50">
          Add a question
        </p>
        <div className="flex flex-wrap gap-2">
          {ADD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addField(t)}
              disabled={fields.length >= MAX_FORM_FIELDS}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3B0A45]/15 bg-white px-4 py-2 text-sm font-medium text-[#3B0A45] transition hover:border-[#D6336C]/40 hover:text-[#D6336C] disabled:opacity-40"
            >
              <Plus className="size-4" />
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
        <p className="text-sm text-[#2B0A33]/60">
          <span className="font-semibold text-[#3B0A45]">
            {fields.length} / {MAX_FORM_FIELDS}
          </span>{" "}
          questions
          {dirty && (
            <span className="ml-2 inline-flex rounded-full bg-[#F4A300]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#a06c00]">
              Unsaved changes
            </span>
          )}
        </p>
        <form action={formAction} className="sm:ml-auto">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-[#3B0A45] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Saving…" : "Save form"}
          </button>
        </form>
      </div>

      {state.message && (
        <p
          className={`flex items-center gap-1.5 text-sm font-medium ${
            state.ok ? "text-[#0a8485]" : "text-[#D6336C]"
          }`}
        >
          {state.ok && <CheckCircle2 className="size-4" />}
          {state.message}
        </p>
      )}
    </div>
  );
}
