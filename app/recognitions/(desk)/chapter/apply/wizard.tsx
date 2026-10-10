"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WORDS, type Vertical } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine, WordField } from "../../../_ui/client";
import { Notice, Seal, Stepper, formatWhen } from "../../../_ui/primitives";
import { Ribbon } from "../../../_ui/ribbon";
import { IconArrowLeft, IconArrowRight, IconCheck, IconLock } from "../../../_ui/icons";
import {
  deleteNominationDraft,
  saveNominationDrafts,
  submitNominations,
} from "../../../actions/chapter";
import { emptyForm, validateNomination, type NominationForm } from "../shared";
import { NominationSummary } from "../summary";
import { NominationFields } from "./fields";

export type WizardAward = { id: string; title: string; vertical: Vertical; criteria: string | null };
export type WizardInitial = {
  awardId: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
  form: NominationForm;
};

type Dialog = { kind: "deselect"; awardId: string } | { kind: "submit" } | null;

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
  const [step, setStep] = useState(0);

  // What the server holds, kept current locally after each successful action.
  const [saved, setSaved] = useState<Record<string, { status: "draft" | "submitted"; submittedAt: string | null }>>(
    () => Object.fromEntries(initial.map((i) => [i.awardId, { status: i.status, submittedAt: i.submittedAt }]))
  );
  const [forms, setForms] = useState<Record<string, NominationForm>>(() =>
    Object.fromEntries(initial.map((i) => [i.awardId, i.form]))
  );
  const [selected, setSelected] = useState<string[]>(() =>
    initial.filter((i) => i.status === "draft").map((i) => i.awardId)
  );

  const awardById = useMemo(() => new Map(awards.map((a) => [a.id, a])), [awards]);
  // Steps follow the award order, not the click order.
  const chosen = awards.filter((a) => selected.includes(a.id) && saved[a.id]?.status !== "submitted");
  const submittedAwards = awards.filter((a) => saved[a.id]?.status === "submitted");
  const steps = ["Choose awards", ...chosen.map((a) => a.title), "Review & submit"];
  const lastStep = steps.length - 1;
  const current = Math.min(step, lastStep);

  const problemsById = Object.fromEntries(
    chosen.map((a) => [a.id, validateNomination(forms[a.id] ?? emptyForm(a.id), { forSubmit: true })])
  );
  const readyToSubmit = chosen.length > 0 && chosen.every((a) => problemsById[a.id].length === 0);

  function patch(awardId: string, change: Partial<NominationForm>) {
    setForms((f) => ({ ...f, [awardId]: { ...(f[awardId] ?? emptyForm(awardId)), ...change } }));
  }

  function toggle(awardId: string) {
    if (saved[awardId]?.status === "submitted") return;
    if (selected.includes(awardId)) {
      if (saved[awardId]?.status === "draft") {
        setDialog({ kind: "deselect", awardId });
        return;
      }
      setSelected((s) => s.filter((id) => id !== awardId));
      setForms((f) => {
        const next = { ...f };
        delete next[awardId];
        return next;
      });
      return;
    }
    setSelected((s) => [...s, awardId]);
    setForms((f) => (f[awardId] ? f : { ...f, [awardId]: emptyForm(awardId) }));
  }

  function payload() {
    return chosen.map((a) => forms[a.id] ?? emptyForm(a.id));
  }

  function saveDraft() {
    if (chosen.length === 0) {
      setResult({ ok: false, text: "Choose at least one award first." });
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
        setForms((f) => {
          const next = { ...f };
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
        setStep(0);
        setResult({ ok: true, text: res.message ?? "Submitted." });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
      setDialog(null);
    });
  }

  const go = (n: number) => {
    setResult(null);
    setStep(Math.max(0, Math.min(n, lastStep)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const footer = (
    <div className="rx-stack" style={{ marginTop: 24 }}>
      <ResultLine result={result} />
      <div className="rx-spread">
        <div className="rx-row">
          {current > 0 ? (
            <button type="button" className="rx-btn rx-btn-quiet" onClick={() => go(current - 1)} disabled={pending}>
              <IconArrowLeft size={16} /> Back
            </button>
          ) : null}
          {chosen.length > 0 ? (
            <button type="button" className="rx-btn rx-btn-quiet" onClick={saveDraft} disabled={pending}>
              {pending ? "Saving…" : "Save draft"}
            </button>
          ) : null}
        </div>
        {current < lastStep ? (
          <button
            type="button"
            className="rx-btn"
            onClick={() => go(current + 1)}
            disabled={pending || chosen.length === 0}
          >
            Next: {steps[current + 1]} <IconArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="rx-btn rx-btn-gilt"
            onClick={() => setDialog({ kind: "submit" })}
            disabled={pending || !readyToSubmit}
          >
            <IconCheck size={16} /> {chosen.length === 1 ? "Submit nomination" : `Submit ${chosen.length} nominations`}
          </button>
        )}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (current === 0) {
    body = (
      <section className="rx-stack">
        <div>
          <h2 className="rx-h2">Choose the awards {chapterName} is applying for</h2>
          <p className="rx-mute rx-small">
            Each award you choose gets its own step. Drafts are not entered: submit before{" "}
            {formatWhen(deadline)}.
          </p>
        </div>
        <div className="rx-stack" style={{ gap: 0 }}>
          {awards.map((a) => {
            const s = saved[a.id]?.status;
            const isSubmitted = s === "submitted";
            const on = isSubmitted || selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className="rx-tile"
                style={{ marginTop: 8 }}
                aria-pressed={on}
                disabled={isSubmitted || pending}
                onClick={() => toggle(a.id)}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    flex: "none",
                    borderRadius: 4,
                    border: "1.5px solid var(--rx-line-strong)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? "var(--rx-laurel)" : "transparent",
                    color: "#fff",
                  }}
                >
                  {isSubmitted ? <IconLock size={14} /> : on ? <IconCheck size={14} /> : null}
                </span>
                <Ribbon vertical={a.vertical} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="rx-h3" style={{ display: "block" }}>{a.title}</span>
                  {isSubmitted ? (
                    <span className="rx-small rx-mute">
                      Submitted {formatWhen(saved[a.id]?.submittedAt)}. Locked.
                    </span>
                  ) : s === "draft" ? (
                    <span className="rx-small rx-mute">Draft saved</span>
                  ) : null}
                </span>
                {isSubmitted ? <Seal tone="laurel">Submitted</Seal> : null}
              </button>
            );
          })}
        </div>
      </section>
    );
  } else if (current < lastStep) {
    const award = chosen[current - 1];
    const f = forms[award.id] ?? emptyForm(award.id);
    body = (
      <section className="rx-stack-lg">
        <div className="rx-stack">
          <div className="rx-row" style={{ gap: 10 }}>
            <Ribbon vertical={award.vertical} size="lg" />
            <h2 className="rx-h2">{award.title}</h2>
          </div>
          {award.criteria ? (
            <p className="rx-small rx-mute" style={{ whiteSpace: "pre-line" }}>{award.criteria}</p>
          ) : null}
        </div>

        <NominationFields idPrefix={award.id} form={f} onChange={(change) => patch(award.id, change)} />
      </section>
    );
  } else {
    body = (
      <section className="rx-stack">
        <div>
          <h2 className="rx-h2">Review and submit</h2>
          <p className="rx-mute rx-small">
            Once submitted, a nomination is locked. It can&apos;t be edited or withdrawn.
          </p>
        </div>
        {chosen.length === 0 ? (
          <Notice>No award is waiting to be submitted. Go back to step 1 to choose one.</Notice>
        ) : (
          chosen.map((a, i) => {
            const problems = problemsById[a.id];
            return (
              <div key={a.id} className="rx-stack" style={{ gap: 0 }}>
                <NominationSummary
                  title={a.title}
                  vertical={a.vertical}
                  form={forms[a.id] ?? emptyForm(a.id)}
                  status={saved[a.id]?.status ?? "new"}
                />
                {problems.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <Notice tone="alert">
                      <strong>Still needed before you can submit:</strong>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                        {problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="rx-btn rx-btn-sm rx-btn-quiet"
                        style={{ marginTop: 8 }}
                        onClick={() => go(i + 1)}
                      >
                        Fix {a.title}
                      </button>
                    </Notice>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        {submittedAwards.length > 0 ? (
          <p className="rx-small rx-mute">
            Already submitted and locked: {submittedAwards.map((a) => a.title).join(", ")}.
          </p>
        ) : null}
      </section>
    );
  }

  const dialogAward = dialog?.kind === "deselect" ? awardById.get(dialog.awardId) : undefined;

  return (
    <div>
      <Stepper steps={steps} current={current} />
      {body}
      {footer}
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
            nominations are locked and can&apos;t be edited or withdrawn.
          </p>
        ) : (
          <p>
            The saved draft for {dialogAward?.title ?? "this award"} will be deleted. Everything written in it is
            lost.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
