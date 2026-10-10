"use client";

import { useId, useState, useTransition } from "react";
import { CATEGORY_LABEL, WORDS, type Category } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import { ConfirmDialog, ResultLine, WordField } from "@/app/recognitions/_ui/client";
import { addChapterToAward, resubmitAddedNomination, saveAddedReason } from "@/app/recognitions/actions/nl-add";

export type AddOption = { id: string; name: string; region: string; category: Category };

/**
 * National Leadership: add a chapter that did not nominate (recognitions_03).
 * Picker (only eligible chapters) + one reason (100 words) + a confirm step
 * inside the page. The server re-checks every rule; this only previews.
 */
export function AddChapterPanel({
  awardId,
  awardTitle,
  options,
  skipped,
  sendsBack,
  closesAt,
}: {
  awardId: string;
  awardTitle: string;
  options: AddOption[];
  skipped: Array<{ name: string; why: string }>;
  /** True while the award is in National Leadership review: adding sends it back for re-evaluation. */
  sendsBack: boolean;
  /** Formatted re-evaluation deadline. */
  closesAt: string;
}) {
  const pickId = useId();
  const [chapterId, setChapterId] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const words = countWords(reason);
  const picked = options.find((o) => o.id === chapterId) ?? null;
  const ready = picked !== null && reason.trim() !== "" && words <= WORDS.nlAddedReason;

  function add() {
    setResult(null);
    start(async () => {
      const res = await addChapterToAward(awardId, chapterId, reason);
      setConfirm(false);
      setResult(res.success ? { ok: true, text: res.message ?? "Added." } : { ok: false, text: res.error });
      if (res.success) {
        setChapterId("");
        setReason("");
      }
    });
  }

  return (
    <section className="rx-plate rx-plate-gilt rx-stack" aria-labelledby={`${pickId}-h`}>
      <h2 className="rx-h2" id={`${pickId}-h`}>Add a chapter that didn&apos;t nominate</h2>
      <p className="rx-small rx-mute">
        If a chapter has done great work for {awardTitle} but did not nominate, add it here with your reason. The
        chapter fills nothing and is not told. The Regional Chair and a Regional Mentor for its region still check it,
        then the Regional Mentors and the NMT score it, all by {closesAt}.
        {sendsBack ? " Adding a chapter sends this award back to the NMT leader for re-evaluation." : ""}
      </p>

      {options.length === 0 ? (
        <p className="rx-mute">No chapter can be added to this award right now.</p>
      ) : (
        <>
          <div>
            <label htmlFor={pickId} className="rx-label">Chapter</label>
            <select
              id={pickId}
              className="rx-select"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
            >
              <option value="">Choose a chapter…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.region} · {CATEGORY_LABEL[o.category]}
                </option>
              ))}
            </select>
            <p className="rx-help">Only chapters that did not nominate for this award and can be checked and scored are listed.</p>
          </div>
          <WordField
            label="Why does this chapter deserve to be considered? (required)"
            help="The checkers, Regional Mentors and NMT read this instead of a nomination form."
            value={reason}
            onChange={setReason}
            limit={WORDS.nlAddedReason}
            rows={4}
          />
          <div className="rx-row">
            <button type="button" className="rx-btn rx-btn-gilt" disabled={!ready || pending} onClick={() => setConfirm(true)}>
              Add {picked ? picked.name : "chapter"}
            </button>
          </div>
        </>
      )}
      <ResultLine result={confirm ? null : result} />

      {skipped.length > 0 ? (
        <details className="rx-p-fold">
          <summary>
            <span className="rx-small">Why isn&apos;t a chapter listed? ({skipped.length})</span>
          </summary>
          <div className="rx-p-fold-body">
            <ul className="rx-small rx-stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
              {skipped.map((s) => (
                <li key={s.name} style={{ overflowWrap: "anywhere" }}>
                  <strong>{s.name}</strong>: {s.why}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      <ConfirmDialog
        open={confirm}
        title={picked ? `Add ${picked.name} to ${awardTitle}?` : "Add this chapter?"}
        confirmLabel={picked ? `Add ${picked.name}` : "Add"}
        tone="gilt"
        busy={pending}
        onConfirm={add}
        onClose={() => setConfirm(false)}
      >
        <div className="rx-stack" style={{ gap: 8 }}>
          {picked ? (
            <p className="rx-small">
              {picked.name} ({picked.region}, {CATEGORY_LABEL[picked.category]}) joins {awardTitle} with your reason:
            </p>
          ) : null}
          <p className="rx-p-quote rx-small">{reason.trim()}</p>
          <p className="rx-small">
            {sendsBack
              ? "This also sends the award back to the NMT leader for re-evaluation, with your reason as the note. "
              : ""}
            It can&apos;t be undone: the addition stays on the record. If a checker sends it back, it comes back to you
            to edit the reason.
          </p>
          <ResultLine result={result} />
        </div>
      </ConfirmDialog>
    </section>
  );
}

/**
 * A sent-back NL-added nomination: National Leadership edits its reason and
 * saves, or resubmits (which clears both passes).
 */
export function AddedFixForm({ nominationId, chapterName, initial }: { nominationId: string; chapterName: string; initial: string }) {
  const [reason, setReason] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ok = reason.trim() !== "" && countWords(reason) <= WORDS.nlAddedReason;

  function run(kind: "save" | "resubmit") {
    setResult(null);
    start(async () => {
      const res = kind === "save" ? await saveAddedReason(nominationId, reason) : await resubmitAddedNomination(nominationId, reason);
      setConfirm(false);
      setResult(res.success ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="rx-stack" style={{ gap: 8 }}>
      <WordField label="Your reason" value={reason} onChange={setReason} limit={WORDS.nlAddedReason} rows={4} />
      <div className="rx-row" style={{ gap: 8 }}>
        <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" disabled={!ok || pending} onClick={() => run("save")}>
          Save reason
        </button>
        <button type="button" className="rx-btn rx-btn-sm" disabled={!ok || pending} onClick={() => setConfirm(true)}>
          Resubmit for checks
        </button>
      </div>
      <ResultLine result={confirm ? null : result} />
      <ConfirmDialog
        open={confirm}
        title={`Resubmit ${chapterName}?`}
        confirmLabel="Resubmit"
        busy={pending}
        onConfirm={() => run("resubmit")}
        onClose={() => setConfirm(false)}
      >
        <div className="rx-stack" style={{ gap: 8 }}>
          <p className="rx-small">
            The Regional Chair and a Regional Mentor check it again from the start: any pass it had is cleared, so both
            pass this version.
          </p>
          <p className="rx-p-quote rx-small">{reason.trim()}</p>
          <ResultLine result={result} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
