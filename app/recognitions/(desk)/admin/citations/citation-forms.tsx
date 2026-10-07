"use client";

import { useState } from "react";
import { saveCitationEdit } from "../../../actions/admin-content";
import { WORDS, type Category } from "@/lib/recognitions/constants";
import { ResultLine, WordField } from "../../../_ui/client";
import { useAction } from "../_lib/use-action";

export function PolishForm({
  awardId,
  category,
  rank,
  field,
  original,
  originalLabel,
  current,
}: {
  awardId: string;
  category: Category;
  rank: 1 | 2 | 3;
  field: "citation" | "announcement";
  original: string;
  originalLabel: string;
  current: string;
}) {
  const [text, setText] = useState(current);
  const { pending, result, run } = useAction();
  const limit = field === "citation" ? WORDS.top3Citation : WORDS.announcementDraft;
  const polished = current !== original;
  const label = field === "citation" ? "Citation" : "Announcement text";

  return (
    <form
      className="rx-stack"
      style={{ gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCitationEdit({ awardId, field, category, rank, body: text }));
      }}
    >
      <WordField label={`${label}${polished ? " (polished)" : ""}`} value={text} onChange={setText} limit={limit} rows={5} />
      <details className="rx-ad-details">
        <summary>{originalLabel}</summary>
        <p className="rx-small rx-ad-pre">{original || "Nothing was written."}</p>
      </details>
      <div className="rx-row">
        <button type="submit" className="rx-btn rx-btn-sm" disabled={pending || text.trim() === "" || text === current}>
          {pending ? "Saving…" : `Save polished ${field === "citation" ? "citation" : "announcement"}`}
        </button>
        {text !== current ? (
          <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" onClick={() => setText(current)} disabled={pending}>
            Undo changes
          </button>
        ) : null}
      </div>
      <ResultLine result={result} />
    </form>
  );
}

export function ScriptForm({ awardId, current }: { awardId: string; current: string }) {
  const [text, setText] = useState(current);
  const { pending, result, run } = useAction();
  return (
    <form
      className="rx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCitationEdit({ awardId, field: "ceremony_script", category: null, rank: null, body: text }));
      }}
    >
      <div>
        <label className="rx-label" htmlFor={`script-${awardId}`}>What the host reads for this award</label>
        <textarea
          id={`script-${awardId}`}
          className="rx-textarea"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Introduce the award, then call each category's places in order."
        />
        <p className="rx-help">Included in the ceremony report.</p>
      </div>
      <div>
        <button type="submit" className="rx-btn" disabled={pending || text.trim() === "" || text === current}>
          {pending ? "Saving…" : "Save ceremony script"}
        </button>
      </div>
      <ResultLine result={result} />
    </form>
  );
}
