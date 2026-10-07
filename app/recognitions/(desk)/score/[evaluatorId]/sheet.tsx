"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_LAYER_TOTAL, PARAM_KEYS, PARAMS_FOR_LAYER, WORDS, type Layer, type ParamKey } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import { saveScore } from "@/app/recognitions/actions/score";
import { ConfirmDialog, PipScale, ResultLine, WordField } from "../../../_ui/client";

type Marks = Partial<Record<ParamKey, number>>;

export function ScoreSheet({
  evaluatorId,
  nominationId,
  chapterName,
  layer,
  initialParams,
  initialReasons,
  initialComments,
  readOnly,
}: {
  evaluatorId: string;
  nominationId: string;
  chapterName: string;
  layer: Layer;
  initialParams: Marks;
  initialReasons: string[];
  initialComments: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Marks>(initialParams);
  const [reasons, setReasons] = useState<string[]>(() =>
    [0, 1, 2, 3, 4].map((i) => initialReasons[i] ?? "")
  );
  const [comments, setComments] = useState(initialComments);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const defs = PARAMS_FOR_LAYER[layer];
  const marked = PARAM_KEYS.filter((k) => typeof marks[k] === "number").length;
  const total = PARAM_KEYS.reduce((s, k) => s + (marks[k] ?? 0), 0);

  // What still stands between this sheet and a valid submit, in words.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (marked < 5) out.push(`Mark all five parameters (${5 - marked} still unmarked).`);
    reasons.forEach((r, i) => {
      if (r.trim() === "") out.push(`Write reason ${i + 1}.`);
      else if (countWords(r) > WORDS.evaluatorReason) out.push(`Shorten reason ${i + 1} to ${WORDS.evaluatorReason} words.`);
    });
    if (layer === "nmt" && countWords(comments) > WORDS.nmtComments) {
      out.push(`Shorten the additional comments to ${WORDS.nmtComments} words.`);
    }
    return out;
  }, [marked, reasons, comments, layer]);

  function run(submit: boolean) {
    setResult(null);
    startTransition(async () => {
      const res = await saveScore({ evaluatorId, nominationId, params: marks, reasons, comments, submit });
      if (res.success) {
        setDirty(false);
        setConfirming(false);
        setResult({ ok: true, text: res.message ?? (submit ? "Marks submitted." : "Draft saved.") });
        // Pin the URL to this chapter so the refresh doesn't jump to the next unsubmitted one.
        router.replace(`/recognitions/score/${evaluatorId}?n=${nominationId}`, { scroll: false });
        router.refresh();
      } else {
        setConfirming(false);
        setResult({ ok: false, text: res.error });
      }
    });
  }

  // Auto-save a draft two seconds after the last change, so jumping to another
  // chapter never loses marks. Skipped while a text is over its word limit
  // (the server would refuse it); the problem line already says so.
  const overLimit = problems.some((p) => p.startsWith("Shorten"));
  useEffect(() => {
    if (!dirty || readOnly || pending || overLimit) return;
    const t = setTimeout(async () => {
      const res = await saveScore({ evaluatorId, nominationId, params: marks, reasons, comments, submit: false });
      if (res.success) {
        setDirty(false);
        setResult({ ok: true, text: "Draft saved automatically." });
      } else {
        setResult({ ok: false, text: res.error });
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [dirty, readOnly, pending, overLimit, marks, reasons, comments, evaluatorId, nominationId]);

  function askSubmit() {
    if (problems.length > 0) {
      setResult({ ok: false, text: `Not ready to submit: ${problems[0]}` });
      return;
    }
    setConfirming(true);
  }

  return (
    <div className="rx-stack">
      <section className="rx-plate rx-stack" aria-labelledby="rx-marks-h">
        <div className="rx-spread">
          <h2 className="rx-h2" id="rx-marks-h">Your marks</h2>
          <span className="rx-small rx-mute">{marked} of 5 marked</span>
        </div>
        <div className="rx-sheet-params">
          {defs.map((p) => (
            <PipScale
              key={p.key}
              label={p.label}
              hint={p.hint}
              value={marks[p.key]}
              disabled={readOnly || pending}
              onChange={(v) => {
                setMarks((m) => ({ ...m, [p.key]: v }));
                setDirty(true);
              }}
            />
          ))}
        </div>
        <div className="rx-sheet-total" aria-live="polite">
          <span className="rx-label" style={{ margin: 0 }}>Total</span>
          <span>
            <span className="rx-sheet-total-n">{total}</span>
            <span className="rx-mute rx-num"> / {MAX_LAYER_TOTAL}</span>
          </span>
        </div>
      </section>

      <section className="rx-plate rx-stack" aria-labelledby="rx-just-h">
        <h2 className="rx-h2" id="rx-just-h">Your justification</h2>
        <p className="rx-help" style={{ marginTop: 6 }}>
          Five reasons for your marks, up to {WORDS.evaluatorReason} words each.
        </p>
        {reasons.map((r, i) => (
          <WordField
            key={i}
            label={`Reason ${i + 1}`}
            value={r}
            limit={WORDS.evaluatorReason}
            rows={3}
            readOnly={readOnly}
            onChange={(v) => {
              setReasons((rs) => rs.map((x, j) => (j === i ? v : x)));
              setDirty(true);
            }}
          />
        ))}
        {layer === "nmt" ? (
          <WordField
            label="Additional comments"
            help="Optional. Anything the NMT should weigh that the five reasons don't cover."
            value={comments}
            limit={WORDS.nmtComments}
            rows={6}
            readOnly={readOnly}
            onChange={(v) => {
              setComments(v);
              setDirty(true);
            }}
          />
        ) : null}
      </section>

      {readOnly ? null : (
        <div className="rx-stack" style={{ gap: 8 }}>
          <div className="rx-row">
            <button type="button" className="rx-btn rx-btn-quiet" disabled={pending} onClick={() => run(false)}>
              {pending && !confirming ? "Saving…" : "Save draft"}
            </button>
            <button type="button" className="rx-btn rx-btn-gilt" disabled={pending} onClick={askSubmit}>
              Submit marks
            </button>
            {dirty ? <span className="rx-small rx-mute">You have unsaved changes.</span> : null}
          </div>
        </div>
      )}
      <ResultLine result={result} />

      <ConfirmDialog
        open={confirming}
        title={`Submit your marks for ${chapterName}?`}
        confirmLabel="Submit marks"
        tone="gilt"
        busy={pending}
        onConfirm={() => run(true)}
        onClose={() => setConfirming(false)}
      >
        <p>
          Total {total} / {MAX_LAYER_TOTAL}. Submitted marks can&apos;t be changed.
        </p>
      </ConfirmDialog>
    </div>
  );
}
