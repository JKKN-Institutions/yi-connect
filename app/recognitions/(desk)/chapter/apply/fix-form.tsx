"use client";

import { useState } from "react";
import { CHECK_STEP_ENABLED, WORDS, type AwardKind, type Vertical } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine, WordField } from "../../../_ui/client";
import { Seal, formatWhen } from "../../../_ui/primitives";
import { Ribbon } from "../../../_ui/ribbon";
import { IconCheck } from "../../../_ui/icons";
import { resubmitNomination } from "../../../actions/chapter";
import { useAction } from "../../admin/_lib/use-action";
import { validateNomination, type NominationForm } from "../shared";
import { NominationFields } from "./fields";
import "../../../_parts/parts.css";

/**
 * A nomination a checker sent back (recognitions_02): the note, the fix-by
 * date, the editable answer and Resubmit. Resubmitting clears both passes,
 * so the Regional Chair and a Regional Mentor check the new version.
 * 2026: the check step is off, so no new send-backs happen; this stays for
 * any row sent back before. A 2026 row is its "why"; an older one (legacy)
 * is fixed on the old sections.
 */
export function FixReturnedForm({
  chapterId,
  award,
  initial,
  note,
  returnedBy,
  returnedAt,
  fixDeadline,
  legacy,
}: {
  chapterId: string;
  award: { id: string; title: string; vertical: Vertical; kind: AwardKind | null; criteria: string | null };
  initial: NominationForm;
  note: string;
  returnedBy: string;
  returnedAt: string | null;
  fixDeadline: string | null;
  /** Filed on the old form (before recognitions_04): fix the old sections. */
  legacy: boolean;
}) {
  const [form, setForm] = useState<NominationForm>(initial);
  const [confirm, setConfirm] = useState(false);
  const { pending, result, run } = useAction();
  const problems = validateNomination(form, { forSubmit: true, legacy });

  return (
    <article className="rx-plate rx-stack-lg" aria-labelledby={`fix-${award.id}`}>
      <div className="rx-stack">
        <div className="rx-spread">
          <div className="rx-row" style={{ gap: 10, minWidth: 0 }}>
            <Ribbon vertical={award.vertical} kind={award.kind} size="lg" />
            <h2 className="rx-h2" id={`fix-${award.id}`} style={{ overflowWrap: "anywhere" }}>{award.title}</h2>
          </div>
          <Seal tone="vermilion">Sent back</Seal>
        </div>
        <div className="rx-notice rx-notice-alert">
          <div className="rx-small">
            <strong>{returnedBy}</strong> sent this back{returnedAt ? ` on ${formatWhen(returnedAt)}` : ""}:
          </div>
          <p className="rx-p-quote" style={{ marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note}</p>
          <p className="rx-small" style={{ marginTop: 6, fontWeight: 600 }}>
            {fixDeadline
              ? `Fix and resubmit by ${formatWhen(fixDeadline)}. If it is still sent back after that, it is not considered this year.`
              : CHECK_STEP_ENABLED
                ? "Fix and resubmit it. It is not scored until both checkers pass it."
                : "Fix and resubmit it. It is not scored until you do."}
          </p>
        </div>
      </div>

      {legacy ? (
        <NominationFields idPrefix={`fix-${award.id}`} form={form} onChange={(c) => setForm((f) => ({ ...f, ...c }))} />
      ) : (
        <WordField
          label="Why should your chapter get this recognition?"
          value={form.justification}
          limit={WORDS.justification}
          rows={4}
          onChange={(v) => setForm((f) => ({ ...f, justification: v }))}
        />
      )}

      {problems.length > 0 ? (
        <ul className="rx-small" style={{ color: "var(--rx-vermilion)", margin: 0, paddingLeft: 18 }}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      <div>
        <button type="button" className="rx-btn" disabled={pending || problems.length > 0} onClick={() => setConfirm(true)}>
          <IconCheck size={16} /> Resubmit
        </button>
      </div>
      <ResultLine result={result} />

      <ConfirmDialog
        open={confirm}
        title={`Resubmit ${award.title}?`}
        confirmLabel="Resubmit"
        busy={pending}
        onClose={() => setConfirm(false)}
        onConfirm={() => run(() => resubmitNomination(chapterId, form), (r) => r.success && setConfirm(false))}
      >
        {CHECK_STEP_ENABLED ? (
          <p>
            It goes back to the Regional Chair and a Regional Mentor. Both check this new version from the start, even
            if one of them had passed it before. It is locked again until they do.
          </p>
        ) : (
          <p>It is locked again once resubmitted and goes forward to scoring.</p>
        )}
        <ResultLine result={result} />
      </ConfirmDialog>
    </article>
  );
}
