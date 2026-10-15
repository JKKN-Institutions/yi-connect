"use client";

import { useState } from "react";
import { addAllAwards, saveAward } from "../../../actions/admin-setup";
import { KINDS, KIND_SINGULAR, isKind, verticalLabel, type AwardKind } from "@/lib/recognitions/constants";
import { ResultLine } from "../../../_ui/client";
import { Ribbon } from "../../../_ui/ribbon";
import { useAction } from "../_lib/use-action";

type AwardValue = {
  id: string;
  vertical: string;
  kind: AwardKind | "";
  title: string;
  criteria: string;
  sortOrder: number;
  isActive: boolean;
};

/** A known key the cycle doesn't have yet, offered when adding. */
export type Suggestion = { slug: string; kind: AwardKind; title: string };

const blank = (s?: Suggestion): AwardValue => ({
  id: "",
  vertical: s?.slug ?? "",
  kind: s?.kind ?? "",
  title: s?.title ?? "",
  criteria: "",
  sortOrder: 0,
  isActive: true,
});

/**
 * Edit one recognition (title, kind, criteria, order, active), or add a new
 * one with its own key. recognitions_04: the key is any short slug, so the
 * super admin can add a recognition the app has never heard of.
 */
export function AwardForm({ award, suggestions = [] }: { award: AwardValue | null; suggestions?: Suggestion[] }) {
  const [v, setV] = useState<AwardValue>(award ?? blank());
  const { pending, result, run } = useAction();
  const isNew = !award;
  const id = v.id || "new";

  return (
    <form
      className="rx-plate rx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveAward({
              awardId: isNew ? null : v.id,
              vertical: v.vertical.trim(),
              kind: v.kind,
              title: v.title,
              criteria: v.criteria,
              sortOrder: Number(v.sortOrder),
              isActive: v.isActive,
            }),
          (r) => {
            if (r.success && isNew) setV(blank());
          }
        );
      }}
    >
      <div className="rx-spread">
        <div className="rx-row">
          <Ribbon vertical={v.vertical} kind={v.kind || null} size="lg" />
          <span className="rx-eyebrow">
            {isNew ? "New recognition" : verticalLabel(v)}
            {v.kind ? ` · ${KIND_SINGULAR[v.kind]}` : ""}
          </span>
        </div>
        {!isNew ? (
          <label className="rx-row rx-small" style={{ gap: 8 }}>
            <input type="checkbox" className="rx-ad-check" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
            Active
          </label>
        ) : null}
      </div>
      {isNew && suggestions.length > 0 ? (
        <div className="rx-row rx-small" style={{ gap: 6 }}>
          <span className="rx-mute">Not added yet:</span>
          {suggestions.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="rx-btn rx-btn-quiet rx-btn-sm"
              onClick={() => setV({ ...blank(s), sortOrder: v.sortOrder })}
            >
              {s.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="rx-ad-fields">
        {isNew ? (
          <div>
            <label className="rx-label" htmlFor="aw-new-key">Key</label>
            <input
              id="aw-new-key"
              className="rx-input rx-num"
              value={v.vertical}
              placeholder="road_safety"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setV({ ...v, vertical: e.target.value.toLowerCase() })}
            />
            <p className="rx-small rx-mute" style={{ marginTop: 4 }}>
              Small letters, digits and _. It never changes; the title can.
            </p>
          </div>
        ) : null}
        <div>
          <label className="rx-label" htmlFor={`aw-${id}-title`}>Title</label>
          <input id={`aw-${id}-title`} className="rx-input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </div>
        <div>
          <label className="rx-label" htmlFor={`aw-${id}-kind`}>Kind</label>
          <select
            id={`aw-${id}-kind`}
            className="rx-select"
            value={v.kind}
            onChange={(e) => setV({ ...v, kind: isKind(e.target.value) ? e.target.value : "" })}
          >
            <option value="">{isNew ? "Choose…" : "Not set"}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_SINGULAR[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rx-label" htmlFor={`aw-${id}-sort`}>Sort order</label>
          <input
            id={`aw-${id}-sort`}
            className="rx-input rx-num"
            type="number"
            step={1}
            value={v.sortOrder}
            onChange={(e) => setV({ ...v, sortOrder: e.target.value as unknown as number })}
          />
        </div>
      </div>
      <div>
        <label className="rx-label" htmlFor={`aw-${id}-criteria`}>What this recognition is for</label>
        <textarea
          id={`aw-${id}-criteria`}
          className="rx-textarea"
          rows={3}
          value={v.criteria}
          onChange={(e) => setV({ ...v, criteria: e.target.value })}
          placeholder="What chapters see before they apply."
        />
      </div>
      {!isNew && !v.isActive ? (
        <p className="rx-small rx-mute">Inactive recognitions are hidden from chapters and evaluators. Nothing is deleted.</p>
      ) : null}
      <div className="rx-row">
        <button type="submit" className="rx-btn" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add recognition" : "Save recognition"}
        </button>
      </div>
      <ResultLine result={result} />
    </form>
  );
}

export function AddAllAwardsButton({ missing }: { missing: number }) {
  const { pending, result, run } = useAction();
  return (
    <div className="rx-stack" style={{ gap: 6 }}>
      <button type="button" className="rx-btn rx-btn-gilt" disabled={pending} onClick={() => run(() => addAllAwards())}>
        {pending ? "Adding…" : missing === 1 ? "Add the missing one" : `Add the missing ${missing}`}
      </button>
      <ResultLine result={result} />
    </div>
  );
}
