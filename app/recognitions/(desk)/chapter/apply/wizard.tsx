"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WORDS, groupByKind, type AwardKind, type Vertical } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine, WordField } from "../../../_ui/client";
import { Seal, formatWhen } from "../../../_ui/primitives";
import { Ribbon } from "../../../_ui/ribbon";
import { IconCheck, IconLock } from "../../../_ui/icons";
import { deleteNominationDraft, saveNominationDrafts, submitNominations } from "../../../actions/chapter";
import { emptyForm, validateWhy } from "../shared";

export type WizardAward = { id: string; title: string; vertical: Vertical; kind: AwardKind | null; criteria: string | null };
export type WizardInitial = {
  awardId: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
  justification: string;
};

type Dialog = { kind: "deselect"; awardId: string } | { kind: "submit" } | null;

const WHY_LABEL = "Why should your chapter get this recognition?";

/**
 * The 2026 application (recognitions_04, Director 2026-10-15): every active
 * recognition on one page, grouped by kind. The chapter ticks the ones it
 * applies for and writes one compulsory "why" (WORDS.justification words)
 * for each tick. Save draft and submit work as before; the server re-checks
 * everything with the same validator.
 */
export function ApplyWizard({
  chapterId,
  chapterName,
  awards,
  initial,
  deadline,
}: {
  chapterId: string;
  chapterName: string;
  awards: WizardAward[];
  initial: WizardInitial[];
  deadline: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  // After a refused submit, each box shows what is still wrong with it.
  const [attempted, setAttempted] = useState(false);

  // What the server holds, kept current locally after each successful action.
  const [saved, setSaved] = useState<Record<string, { status: "draft" | "submitted"; submittedAt: string | null }>>(
    () => Object.fromEntries(initial.map((i) => [i.awardId, { status: i.status, submittedAt: i.submittedAt }]))
  );
  const [whys, setWhys] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((i) => [i.awardId, i.justification]))
  );
  const [selected, setSelected] = useState<string[]>(() =>
    initial.filter((i) => i.status === "draft").map((i) => i.awardId)
  );

  const awardById = useMemo(() => new Map(awards.map((a) => [a.id, a])), [awards]);
  const groups = useMemo(() => groupByKind(awards), [awards]);
  // Page order, not click order.
  const chosen = awards.filter((a) => selected.includes(a.id) && saved[a.id]?.status !== "submitted");
  const submittedCount = awards.filter((a) => saved[a.id]?.status === "submitted").length;

  const whyOf = (id: string) => whys[id] ?? "";
  const problemsOf = (id: string, forSubmit: boolean) => validateWhy(whyOf(id), { forSubmit });

  function toggle(awardId: string) {
    if (saved[awardId]?.status === "submitted") return;
    setResult(null);
    if (selected.includes(awardId)) {
      if (saved[awardId]?.status === "draft") {
        setDialog({ kind: "deselect", awardId });
        return;
      }
      setSelected((s) => s.filter((id) => id !== awardId));
      return;
    }
    setSelected((s) => [...s, awardId]);
  }

  function payload() {
    return chosen.map((a) => ({ ...emptyForm(a.id), justification: whyOf(a.id) }));
  }

  /** Every problem across the ticked recognitions, one line each. */
  function problemLines(forSubmit: boolean): string[] {
    return chosen.flatMap((a) => problemsOf(a.id, forSubmit).map((p) => `${a.title}: ${p}`));
  }

  function saveDraft() {
    if (chosen.length === 0) {
      setResult({ ok: false, text: "Tick at least one recognition first." });
      return;
    }
    const lines = problemLines(false);
    if (lines.length > 0) {
      setAttempted(true);
      setResult({ ok: false, text: `Not saved. ${lines.join(" ")}` });
      return;
    }
    startTransition(async () => {
      const res = await saveNominationDrafts(chapterId, payload());
      if (res.success) {
        const ids = chosen.map((a) => a.id);
        setSaved((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, { status: "draft" as const, submittedAt: null }])) }));
        setResult({ ok: true, text: res.message ?? "Draft saved." });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  function trySubmit() {
    if (chosen.length === 0) {
      setResult({ ok: false, text: "Tick at least one recognition before you submit." });
      return;
    }
    const lines = problemLines(true);
    if (lines.length > 0) {
      setAttempted(true);
      setResult({ ok: false, text: `Not submitted. ${lines.join(" ")}` });
      return;
    }
    setResult(null);
    setDialog({ kind: "submit" });
  }

  function confirmDeselect(awardId: string) {
    startTransition(async () => {
      const res = await deleteNominationDraft(chapterId, awardId);
      if (res.success) {
        setSelected((s) => s.filter((id) => id !== awardId));
        setSaved((s) => {
          const next = { ...s };
          delete next[awardId];
          return next;
        });
        setResult({ ok: true, text: res.message ?? "Draft removed." });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
      setDialog(null);
    });
  }

  function confirmSubmit() {
    startTransition(async () => {
      const res = await submitNominations(chapterId, payload());
      if (res.success) {
        const now = new Date().toISOString();
        const ids = chosen.map((a) => a.id);
        setSaved((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, { status: "submitted" as const, submittedAt: now }])) }));
        setSelected([]);
        setAttempted(false);
        setResult({ ok: true, text: res.message ?? "Submitted." });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
      setDialog(null);
    });
  }

  const dialogAward = dialog?.kind === "deselect" ? awardById.get(dialog.awardId) : undefined;

  return (
    <div className="rx-stack-lg">
      <div>
        <h2 className="rx-h2">Choose the recognitions {chapterName} is applying for</h2>
        <p className="rx-mute rx-small">
          {awards.length} recognition{awards.length === 1 ? "" : "s"} this year. Submit before {formatWhen(deadline)}.
          {submittedCount > 0 ? ` ${submittedCount} already submitted.` : ""}
        </p>
      </div>

      {groups.map((g) => (
        <fieldset key={g.kind ?? "other"} className="rx-stack" style={{ border: 0, padding: 0, margin: 0, gap: 0 }}>
          <legend className="rx-eyebrow">{g.label}</legend>
          {g.items.map((a) => {
            const s = saved[a.id]?.status;
            const isSubmitted = s === "submitted";
            const on = isSubmitted || selected.includes(a.id);
            const inputId = `rx-apply-${a.id}`;
            const problems = attempted && on && !isSubmitted ? problemsOf(a.id, true) : [];
            return (
              <article
                key={a.id}
                className="rx-plate rx-plate-tight rx-stack"
                style={{ marginTop: 10, borderColor: on ? "var(--rx-laurel)" : undefined }}
                data-award={a.id}
              >
                <div className="rx-spread" style={{ alignItems: "flex-start" }}>
                  <label htmlFor={inputId} className="rx-row" style={{ gap: 10, cursor: isSubmitted ? "default" : "pointer", flex: "1 1 220px", minWidth: 0 }}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={on}
                      disabled={isSubmitted || pending}
                      onChange={() => toggle(a.id)}
                      style={{ width: 22, height: 22, flex: "none", accentColor: "var(--rx-laurel)" }}
                    />
                    <Ribbon vertical={a.vertical} kind={a.kind} />
                    <span className="rx-h3" style={{ overflowWrap: "anywhere" }}>{a.title}</span>
                  </label>
                  {isSubmitted ? (
                    <Seal tone="laurel">
                      <IconLock size={12} /> Submitted
                    </Seal>
                  ) : s === "draft" ? (
                    <Seal tone="gilt">Draft saved</Seal>
                  ) : null}
                </div>
                {a.criteria ? (
                  <p className="rx-small rx-mute" style={{ whiteSpace: "pre-line" }}>{a.criteria}</p>
                ) : null}
                {isSubmitted ? (
                  <div className="rx-small">
                    <div className="rx-mute">Submitted {formatWhen(saved[a.id]?.submittedAt)}. Locked.</div>
                    {whyOf(a.id).trim() ? (
                      <p style={{ marginTop: 4, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{whyOf(a.id)}</p>
                    ) : null}
                  </div>
                ) : on ? (
                  <div>
                    <WordField
                      label={WHY_LABEL}
                      value={whyOf(a.id)}
                      limit={WORDS.justification}
                      rows={4}
                      onChange={(v) => setWhys((w) => ({ ...w, [a.id]: v }))}
                    />
                    {problems.length > 0 ? (
                      <p role="alert" className="rx-small" style={{ color: "var(--rx-vermilion)", fontWeight: 600, marginTop: 4 }}>
                        {problems.join(" ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </fieldset>
      ))}

      <div className="rx-stack">
        <ResultLine result={result} />
        <div className="rx-spread">
          <button type="button" className="rx-btn rx-btn-quiet" onClick={saveDraft} disabled={pending || chosen.length === 0}>
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button type="button" className="rx-btn rx-btn-gilt" onClick={trySubmit} disabled={pending || chosen.length === 0}>
            <IconCheck size={16} />{" "}
            {chosen.length === 0
              ? "Submit"
              : chosen.length === 1
                ? "Submit 1 nomination"
                : `Submit ${chosen.length} nominations`}
          </button>
        </div>
        {chosen.length === 0 ? (
          <p className="rx-small rx-mute">Tick a recognition above to start.</p>
        ) : (
          <p className="rx-small rx-mute">
            Ticked: {chosen.map((a) => a.title).join(", ")}.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.kind === "submit" ? "Submit your nominations?" : "Remove this draft?"}
        confirmLabel={
          dialog?.kind === "submit"
            ? chosen.length === 1
              ? "Submit nomination"
              : `Submit ${chosen.length} nominations`
            : "Remove draft"
        }
        tone={dialog?.kind === "submit" ? "gilt" : "danger"}
        busy={pending}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === "submit") confirmSubmit();
          else if (dialog?.kind === "deselect") confirmDeselect(dialog.awardId);
        }}
      >
        {dialog?.kind === "submit" ? (
          <p>
            You are submitting {chosen.map((a) => a.title).join(", ")} for {chapterName}. Once submitted, these
            nominations are locked and can&apos;t be changed or withdrawn.
          </p>
        ) : (
          <p>
            The saved draft for {dialogAward?.title ?? "this recognition"} will be deleted, with the answer written in
            it.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
