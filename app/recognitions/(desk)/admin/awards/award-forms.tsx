"use client";

import { useState } from "react";
import { addAllAwards, saveAward } from "../../../actions/admin-setup";
import { VERTICAL_LABEL, type Vertical } from "@/lib/recognitions/constants";
import { ResultLine } from "../../../_ui/client";
import { Ribbon } from "../../../_ui/ribbon";
import { useAction } from "../_lib/use-action";

type AwardValue = { id: string; vertical: Vertical; title: string; criteria: string; sortOrder: number; isActive: boolean };

export function AwardForm({ award, freeVerticals }: { award: AwardValue | null; freeVerticals: Vertical[] }) {
  const first = freeVerticals[0] ?? "membership";
  const [v, setV] = useState<AwardValue>(
    award ?? { id: "", vertical: first, title: `${VERTICAL_LABEL[first]} Excellence`, criteria: "", sortOrder: 0, isActive: true }
  );
  const { pending, result, run } = useAction();
  const isNew = !award;

  return (
    <form
      className="rx-plate rx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveAward({
              awardId: isNew ? null : v.id,
              vertical: v.vertical,
              title: v.title,
              criteria: v.criteria,
              sortOrder: Number(v.sortOrder),
              isActive: v.isActive,
            }),
          (r) => {
            if (r.success && isNew) {
              const next = freeVerticals.find((f) => f !== v.vertical) ?? first;
              setV({ id: "", vertical: next, title: `${VERTICAL_LABEL[next]} Excellence`, criteria: "", sortOrder: 0, isActive: true });
            }
          }
        );
      }}
    >
      <div className="rx-spread">
        <div className="rx-row">
          <Ribbon vertical={v.vertical} size="lg" />
          <span className="rx-eyebrow">{VERTICAL_LABEL[v.vertical]}</span>
        </div>
        {!isNew ? (
          <label className="rx-row rx-small" style={{ gap: 8 }}>
            <input type="checkbox" className="rx-ad-check" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
            Active
          </label>
        ) : null}
      </div>
      <div className="rx-ad-fields">
        {isNew ? (
          <div>
            <label className="rx-label" htmlFor="aw-new-vertical">Vertical</label>
            <select
              id="aw-new-vertical"
              className="rx-select"
              value={v.vertical}
              onChange={(e) => {
                const vert = e.target.value as Vertical;
                setV({ ...v, vertical: vert, title: `${VERTICAL_LABEL[vert]} Excellence` });
              }}
            >
              {freeVerticals.map((f) => (
                <option key={f} value={f}>{VERTICAL_LABEL[f]}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="rx-label" htmlFor={`aw-${v.id || "new"}-title`}>Title</label>
          <input id={`aw-${v.id || "new"}-title`} className="rx-input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </div>
        <div>
          <label className="rx-label" htmlFor={`aw-${v.id || "new"}-sort`}>Sort order</label>
          <input
            id={`aw-${v.id || "new"}-sort`}
            className="rx-input rx-num"
            type="number"
            step={1}
            value={v.sortOrder}
            onChange={(e) => setV({ ...v, sortOrder: e.target.value as unknown as number })}
          />
        </div>
      </div>
      <div>
        <label className="rx-label" htmlFor={`aw-${v.id || "new"}-criteria`}>Award criteria</label>
        <textarea
          id={`aw-${v.id || "new"}-criteria`}
          className="rx-textarea"
          rows={3}
          value={v.criteria}
          onChange={(e) => setV({ ...v, criteria: e.target.value })}
          placeholder="What chapters see on their dashboard before they apply."
        />
      </div>
      {!isNew && !v.isActive ? (
        <p className="rx-small rx-mute">Inactive awards are hidden from chapters and evaluators. Nothing is deleted.</p>
      ) : null}
      <div className="rx-row">
        <button type="submit" className="rx-btn" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add award" : "Save award"}
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
        {pending ? "Adding…" : missing === 7 ? "Add all seven" : `Add the missing ${missing}`}
      </button>
      <ResultLine result={result} />
    </div>
  );
}
